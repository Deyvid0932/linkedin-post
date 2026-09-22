package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.GitHubTokenRequest;
import com.deyvid.backend.dto.request.LinkedInTokenRequest;
import com.deyvid.backend.dto.request.SaveLinkedInAccountRequest;
import com.deyvid.backend.dto.response.LinkedInAccountResponse;
import com.deyvid.backend.entity.GitHubCredential;
import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.entity.enums.LinkedInAccountType;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.repository.GitHubCredentialRepository;
import com.deyvid.backend.repository.GitHubRepositoryRepo;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.EncryptionService;
import com.deyvid.backend.service.linkedin.LinkedInPublisherService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/credentials")
@Slf4j
public class CredentialController {

    private final AuthHelper authHelper;
    private final LinkedInCredentialRepository linkedInCredentialRepository;
    private final GitHubCredentialRepository gitHubCredentialRepository;
    private final EncryptionService encryptionService;
    private final AuditLogService auditLogService;
    private final LinkedInPublisherService linkedInPublisherService;
    private final WebClient gitHubWebClient;
    private final com.deyvid.backend.repository.PublicationLogRepository publicationLogRepository;

    public CredentialController(
            AuthHelper authHelper,
            LinkedInCredentialRepository linkedInCredentialRepository,
            GitHubCredentialRepository gitHubCredentialRepository,
            GitHubRepositoryRepo gitHubRepositoryRepo,
            EncryptionService encryptionService,
            AuditLogService auditLogService,
            LinkedInPublisherService linkedInPublisherService,
            com.deyvid.backend.repository.PublicationLogRepository publicationLogRepository,
            @Qualifier("gitHubWebClient") WebClient gitHubWebClient,
            @Qualifier("genericWebClient") WebClient genericWebClient) {
        this.authHelper = authHelper;
        this.linkedInCredentialRepository = linkedInCredentialRepository;
        this.gitHubCredentialRepository = gitHubCredentialRepository;
        this.encryptionService = encryptionService;
        this.auditLogService = auditLogService;
        this.linkedInPublisherService = linkedInPublisherService;
        this.publicationLogRepository = publicationLogRepository;
        this.gitHubWebClient = gitHubWebClient;
    }

    @GetMapping("/linkedin/accounts")
    public ResponseEntity<List<LinkedInAccountResponse>> getLinkedInAccounts(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        List<LinkedInCredential> accounts = linkedInCredentialRepository.findByTenantIdOrderByCreatedAtAsc(user.getTenant().getId());

        List<LinkedInAccountResponse> response = accounts.stream()
                .map(this::mapToAccountResponse)
                .toList();

        return ResponseEntity.ok(response);
    }

    @PostMapping("/linkedin/accounts")
    @Transactional
    public ResponseEntity<LinkedInAccountResponse> addOrUpdateLinkedInAccount(
            Authentication auth,
            @Valid @RequestBody SaveLinkedInAccountRequest request) {
        User user = authHelper.getCurrentUser(auth);
        UUID tenantId = user.getTenant().getId();
        LocalDateTime now = LocalDateTime.now();
        int days = request.expiresInDays() != null ? request.expiresInDays() : 60;

        String rawToken;
        if (request.useExistingTokenFromAccountId() != null) {
            LinkedInCredential sourceAcc = linkedInCredentialRepository.findById(request.useExistingTokenFromAccountId())
                    .orElseThrow(() -> new IllegalArgumentException("Cuenta de origen para reutilizar token no encontrada"));
            if (!sourceAcc.getTenant().getId().equals(tenantId)) {
                throw new IllegalArgumentException("Permisos insuficientes sobre la cuenta de origen");
            }
            rawToken = encryptionService.decrypt(sourceAcc.getAccessTokenEnc());
        } else if (request.accessToken() != null && !request.accessToken().isBlank()) {
            rawToken = request.accessToken().trim();
        } else {
            throw new IllegalArgumentException("Se requiere proporcionar un 'accessToken' o seleccionar una cuenta existente.");
        }

        Map<String, String> discovered;
        if (request.accountType() == LinkedInAccountType.PERSON) {
            discovered = linkedInPublisherService.validateAndDiscoverPersonAccount(rawToken);
        } else {
            discovered = linkedInPublisherService.validateAndDiscoverOrganizationAccount(rawToken, request.authorUrn(), request.displayName());
        }

        String resolvedUrn = discovered.get("authorUrn");
        String resolvedName = (request.displayName() != null && !request.displayName().isBlank())
                ? request.displayName().trim()
                : discovered.get("displayName");

        Optional<LinkedInCredential> existingOpt = linkedInCredentialRepository.findByTenantIdAndAuthorUrn(tenantId, resolvedUrn);
        List<LinkedInCredential> currentAccounts = linkedInCredentialRepository.findByTenantIdOrderByCreatedAtAsc(tenantId);
        boolean isFirstAccount = currentAccounts.isEmpty();

        LinkedInCredential cred = existingOpt.orElseGet(() -> LinkedInCredential.builder()
                .tenant(user.getTenant())
                .build());

        cred.setAccountType(request.accountType());
        cred.setAuthorUrn(resolvedUrn);
        cred.setPersonUrn(resolvedUrn);
        cred.setDisplayName(resolvedName);
        if (request.vanityName() != null) cred.setVanityName(request.vanityName().trim());
        if (request.maxPostsPerDay() != null && request.maxPostsPerDay() > 0) cred.setMaxPostsPerDay(request.maxPostsPerDay());
        cred.setAccessTokenEnc(encryptionService.encrypt(rawToken));
        cred.setTokenIssuedAt(now);
        cred.setTokenExpiresAt(now.plusDays(days));
        cred.setIsValid(true);
        cred.setIsEnabled(request.isEnabled() != null ? request.isEnabled() : true);

        if (isFirstAccount || Boolean.TRUE.equals(request.isPrimary())) {
            for (LinkedInCredential acc : currentAccounts) {
                if (!acc.getId().equals(cred.getId()) && Boolean.TRUE.equals(acc.getIsPrimary())) {
                    acc.setIsPrimary(false);
                    linkedInCredentialRepository.save(acc);
                }
            }
            cred.setIsPrimary(true);
        }

        LinkedInCredential saved = linkedInCredentialRepository.save(cred);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "ADD_LINKEDIN_ACCOUNT",
                "Cuenta de LinkedIn conectada: " + resolvedName + " (" + request.accountType() + ", URN: " + resolvedUrn + ")");

        return ResponseEntity.ok(mapToAccountResponse(saved));
    }

    @PutMapping("/linkedin/accounts/{id}")
    @Transactional
    public ResponseEntity<LinkedInAccountResponse> updateLinkedInAccount(
            Authentication auth,
            @PathVariable UUID id,
            @Valid @RequestBody SaveLinkedInAccountRequest request) {
        User user = authHelper.getCurrentUser(auth);
        LinkedInCredential cred = linkedInCredentialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de LinkedIn no encontrada"));

        if (!cred.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        if (request.displayName() != null && !request.displayName().isBlank()) {
            cred.setDisplayName(request.displayName().trim());
        }
        if (request.vanityName() != null) {
            cred.setVanityName(request.vanityName().trim());
        }
        if (request.maxPostsPerDay() != null && request.maxPostsPerDay() > 0) {
            cred.setMaxPostsPerDay(request.maxPostsPerDay());
        }
        if (request.isEnabled() != null) {
            cred.setIsEnabled(request.isEnabled());
        }

        if (request.accessToken() != null && !request.accessToken().isBlank()) {
            String rawToken = request.accessToken().trim();
            if (cred.getAccountType() == LinkedInAccountType.PERSON) {
                linkedInPublisherService.validateAndDiscoverPersonAccount(rawToken);
            } else {
                linkedInPublisherService.validateAndDiscoverOrganizationAccount(rawToken, cred.getAuthorUrn(), cred.getDisplayName());
            }
            int days = request.expiresInDays() != null ? request.expiresInDays() : 60;
            cred.setAccessTokenEnc(encryptionService.encrypt(rawToken));
            cred.setTokenIssuedAt(LocalDateTime.now());
            cred.setTokenExpiresAt(LocalDateTime.now().plusDays(days));
            cred.setIsValid(true);
        }

        LinkedInCredential saved = linkedInCredentialRepository.save(cred);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "UPDATE_LINKEDIN_ACCOUNT", "Cuenta de LinkedIn actualizada: " + saved.getDisplayName());
        return ResponseEntity.ok(mapToAccountResponse(saved));
    }

    @PatchMapping("/linkedin/accounts/{id}/toggle")
    @Transactional
    public ResponseEntity<LinkedInAccountResponse> toggleAccountStatus(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        LinkedInCredential cred = linkedInCredentialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de LinkedIn no encontrada"));

        if (!cred.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        boolean nextVal = !Boolean.TRUE.equals(cred.getIsEnabled());
        cred.setIsEnabled(nextVal);

        if (!nextVal && Boolean.TRUE.equals(cred.getIsPrimary())) {
            cred.setIsPrimary(false);
            List<LinkedInCredential> others = linkedInCredentialRepository.findByTenantIdAndIsEnabledTrue(user.getTenant().getId());
            for (LinkedInCredential other : others) {
                if (!other.getId().equals(cred.getId()) && Boolean.TRUE.equals(other.getIsValid())) {
                    other.setIsPrimary(true);
                    linkedInCredentialRepository.save(other);
                    log.info("Reasignada cuenta principal a: {}", other.getDisplayName());
                    break;
                }
            }
        }

        LinkedInCredential saved = linkedInCredentialRepository.save(cred);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "TOGGLE_LINKEDIN_ACCOUNT",
                "Publicación " + (nextVal ? "habilitada" : "deshabilitada") + " para cuenta: " + saved.getDisplayName());

        return ResponseEntity.ok(mapToAccountResponse(saved));
    }

    @PatchMapping("/linkedin/accounts/{id}/set-primary")
    @Transactional
    public ResponseEntity<LinkedInAccountResponse> setPrimaryAccount(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        LinkedInCredential cred = linkedInCredentialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de LinkedIn no encontrada"));

        if (!cred.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        if (!Boolean.TRUE.equals(cred.getIsEnabled())) {
            throw new IllegalArgumentException("No se puede establecer como cuenta principal una cuenta deshabilitada. Habilítala primero.");
        }

        if (!Boolean.TRUE.equals(cred.getIsValid()) || cred.getTokenExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("No se puede establecer como cuenta principal una cuenta con token expirado.");
        }

        List<LinkedInCredential> accounts = linkedInCredentialRepository.findByTenantIdOrderByCreatedAtAsc(user.getTenant().getId());
        for (LinkedInCredential acc : accounts) {
            acc.setIsPrimary(acc.getId().equals(id));
            linkedInCredentialRepository.save(acc);
        }

        cred.setIsPrimary(true);
        LinkedInCredential saved = linkedInCredentialRepository.save(cred);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "SET_PRIMARY_LINKEDIN",
                "Cuenta establecida como principal: " + saved.getDisplayName());

        return ResponseEntity.ok(mapToAccountResponse(saved));
    }

    @PatchMapping("/linkedin/accounts/{id}/limit")
    @Transactional
    public ResponseEntity<LinkedInAccountResponse> updateAccountLimit(
            Authentication auth,
            @PathVariable UUID id,
            @RequestBody Map<String, Integer> body) {
        User user = authHelper.getCurrentUser(auth);
        LinkedInCredential cred = linkedInCredentialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de LinkedIn no encontrada"));

        if (!cred.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        Integer limit = body.get("maxPostsPerDay");
        if (limit != null && limit > 0) {
            cred.setMaxPostsPerDay(limit);
        } else {
            throw new IllegalArgumentException("El límite debe ser un número entero mayor a 0");
        }

        LinkedInCredential saved = linkedInCredentialRepository.save(cred);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "UPDATE_POST_LIMIT",
                "Límite diario actualizado a " + limit + " post(s)/día para " + saved.getDisplayName());

        return ResponseEntity.ok(mapToAccountResponse(saved));
    }

    @PostMapping("/linkedin/accounts/{id}/reset-today-count")
    @Transactional
    public ResponseEntity<Map<String, Object>> resetTodayCount(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        LinkedInCredential cred = linkedInCredentialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de LinkedIn no encontrada"));

        if (!cred.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        java.time.LocalDateTime startOfDay = java.time.LocalDate.now().atStartOfDay();
        publicationLogRepository.deleteByTenantIdAndStatusAndAuthorUrnAndCreatedAtGreaterThanEqual(
                user.getTenant().getId(), PublicationStatus.SUCCESS, cred.getEffectiveAuthorUrn(), startOfDay);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "RESET_TODAY_QUOTA",
                "Cupo diario de hoy restablecido para pruebas en cuenta " + cred.getDisplayName());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "¡Cupo del día restablecido exitosamente! Puedes realizar tus publicaciones de prueba de inmediato."
        ));
    }

    @DeleteMapping("/linkedin/accounts/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteLinkedInAccount(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        LinkedInCredential cred = linkedInCredentialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de LinkedIn no encontrada"));

        if (!cred.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        boolean wasPrimary = Boolean.TRUE.equals(cred.getIsPrimary());
        linkedInCredentialRepository.delete(cred);

        if (wasPrimary) {
            List<LinkedInCredential> remaining = linkedInCredentialRepository.findByTenantIdOrderByCreatedAtAsc(user.getTenant().getId());
            if (!remaining.isEmpty()) {
                LinkedInCredential next = remaining.get(0);
                next.setIsPrimary(true);
                linkedInCredentialRepository.save(next);
            }
        }

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "DELETE_LINKEDIN_ACCOUNT",
                "Cuenta de LinkedIn desconectada: " + cred.getDisplayName() + " (" + cred.getAccountType() + ")");

        return ResponseEntity.ok(Map.of(
                "message", "Cuenta de LinkedIn desconectada exitosamente",
                "id", id
        ));
    }

    @PostMapping("/linkedin/accounts/{id}/test")
    public ResponseEntity<Map<String, Object>> testSpecificAccount(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        LinkedInCredential cred = linkedInCredentialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de LinkedIn no encontrada"));

        if (!cred.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        String token = encryptionService.decrypt(cred.getAccessTokenEnc());
        try {
            if (cred.getAccountType() == LinkedInAccountType.PERSON) {
                Map<String, String> info = linkedInPublisherService.validateAndDiscoverPersonAccount(token);
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "Conexión a Perfil Personal verificada exitosamente en LinkedIn",
                        "accountName", info.get("displayName"),
                        "authorUrn", info.get("authorUrn")
                ));
            } else {
                Map<String, String> info = linkedInPublisherService.validateAndDiscoverOrganizationAccount(token, cred.getAuthorUrn(), cred.getDisplayName());
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "Conexión a Página de Empresa verificada exitosamente en LinkedIn",
                        "accountName", info.get("displayName"),
                        "authorUrn", info.get("authorUrn")
                ));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Error al verificar cuenta con la API de LinkedIn: " + e.getMessage()
            ));
        }
    }


    @GetMapping("/linkedin/status")
    public ResponseEntity<Map<String, Object>> getLinkedInStatus(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        Optional<LinkedInCredential> credOpt = linkedInCredentialRepository.findByTenantId(user.getTenant().getId());

        if (credOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("connected", false, "status", "NOT_CONFIGURED"));
        }

        LinkedInCredential cred = credOpt.get();
        boolean isExpired = cred.getTokenExpiresAt().isBefore(LocalDateTime.now());
        long daysRemaining = Math.max(0, Duration.between(LocalDateTime.now(), cred.getTokenExpiresAt()).toDays());

        return ResponseEntity.ok(Map.of(
                "connected", cred.getIsValid() && !isExpired && Boolean.TRUE.equals(cred.getIsEnabled()),
                "personUrn", cred.getEffectiveAuthorUrn(),
                "authorUrn", cred.getEffectiveAuthorUrn(),
                "displayName", cred.getDisplayName() != null ? cred.getDisplayName() : "Perfil Personal",
                "accountType", cred.getAccountType().name(),
                "expiresAt", cred.getTokenExpiresAt(),
                "daysRemaining", daysRemaining,
                "status", isExpired ? "EXPIRED" : (!Boolean.TRUE.equals(cred.getIsEnabled()) ? "DISABLED" : (daysRemaining <= 7 ? "EXPIRING_SOON" : "ACTIVE"))
        ));
    }

    @PostMapping("/linkedin/test")
    public ResponseEntity<Map<String, Object>> testLinkedInConnection(
            Authentication auth,
            @RequestBody(required = false) LinkedInTokenRequest request) {
        User user = authHelper.getCurrentUser(auth);
        String tokenToTest;

        if (request != null && request.accessToken() != null && !request.accessToken().isBlank()) {
            tokenToTest = request.accessToken().trim();
        } else {
            LinkedInCredential cred = linkedInCredentialRepository.findByTenantId(user.getTenant().getId())
                    .orElseThrow(() -> new IllegalArgumentException("No hay token de LinkedIn configurado para probar"));
            tokenToTest = encryptionService.decrypt(cred.getAccessTokenEnc());
        }

        try {
            Map<String, String> info = linkedInPublisherService.validateAndDiscoverPersonAccount(tokenToTest);
            auditLogService.recordAction(user.getTenant(), user.getEmail(), "TEST_LINKEDIN_SUCCESS", "Conexión a LinkedIn verificada con éxito");

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Token de LinkedIn verificado exitosamente con la API oficial",
                    "accountName", info.get("displayName")
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/linkedin")
    public ResponseEntity<Map<String, Object>> saveLinkedInCredential(Authentication auth, @Valid @RequestBody LinkedInTokenRequest request) {
        return processSaveLinkedIn(auth, request, "Credenciales de LinkedIn guardadas exitosamente");
    }

    @PutMapping("/linkedin")
    public ResponseEntity<Map<String, Object>> updateLinkedInCredential(Authentication auth, @Valid @RequestBody LinkedInTokenRequest request) {
        return processSaveLinkedIn(auth, request, "Credenciales de LinkedIn actualizadas exitosamente");
    }

    @DeleteMapping("/linkedin")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteLinkedInCredential(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        List<LinkedInCredential> accounts = linkedInCredentialRepository.findByTenantIdOrderByCreatedAtAsc(user.getTenant().getId());

        if (!accounts.isEmpty()) {
            linkedInCredentialRepository.deleteAll(accounts);
            auditLogService.recordAction(user.getTenant(), user.getEmail(), "REVOKE_LINKEDIN", "Todas las cuentas de LinkedIn fueron eliminadas y revocadas");
        }

        return ResponseEntity.ok(Map.of("message", "Credenciales de LinkedIn eliminadas exitosamente", "connected", false));
    }

    // =========================================================================
    // GITHUB CREDENTIALS
    // =========================================================================

    @GetMapping("/github/status")
    public ResponseEntity<Map<String, Object>> getGitHubStatus(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        Optional<GitHubCredential> credOpt = gitHubCredentialRepository.findByTenantId(user.getTenant().getId());

        if (credOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("connected", false, "status", "NOT_CONFIGURED"));
        }

        GitHubCredential cred = credOpt.get();
        return ResponseEntity.ok(Map.of(
                "connected", cred.getIsValid(),
                "username", cred.getGithubUsername(),
                "status", cred.getIsValid() ? "ACTIVE" : "INVALID"
        ));
    }

    @PostMapping("/github/test")
    public ResponseEntity<Map<String, Object>> testGitHubConnection(
            Authentication auth,
            @RequestBody(required = false) GitHubTokenRequest request) {
        User user = authHelper.getCurrentUser(auth);
        String tokenToTest;

        if (request != null && request.personalAccessToken() != null && !request.personalAccessToken().isBlank()) {
            tokenToTest = request.personalAccessToken().trim();
        } else {
            GitHubCredential cred = gitHubCredentialRepository.findByTenantId(user.getTenant().getId())
                    .orElseThrow(() -> new IllegalArgumentException("No hay token de GitHub configurado para probar"));
            tokenToTest = encryptionService.decrypt(cred.getPersonalAccessTokenEnc());
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> userResponse = gitHubWebClient.get()
                    .uri("/user")
                    .header("Authorization", "Bearer " + tokenToTest)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            String username = userResponse != null && userResponse.containsKey("login") ? userResponse.get("login").toString() : "Usuario GitHub";
            auditLogService.recordAction(user.getTenant(), user.getEmail(), "TEST_GITHUB_SUCCESS", "Token de GitHub verificado para usuario: " + username);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Token de GitHub verificado exitosamente con la API oficial",
                    "username", username
            ));
        } catch (Exception e) {
            log.warn("Fallo al validar token de GitHub: {}", e.getMessage());
            boolean isAuthError = e.getMessage() != null && (e.getMessage().contains("401") || e.getMessage().contains("403"));
            String msg = isAuthError ? "El Personal Access Token de GitHub es inválido o no tiene permisos de lectura" : "Error de conectividad al validar con GitHub: " + e.getMessage();
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", msg
            ));
        }
    }

    @PostMapping("/github")
    public ResponseEntity<Map<String, Object>> saveGitHubCredential(Authentication auth, @Valid @RequestBody GitHubTokenRequest request) {
        return processSaveGitHub(auth, request, "Credenciales de GitHub guardadas exitosamente");
    }

    @PutMapping("/github")
    public ResponseEntity<Map<String, Object>> updateGitHubCredential(Authentication auth, @Valid @RequestBody GitHubTokenRequest request) {
        return processSaveGitHub(auth, request, "Credenciales de GitHub actualizadas exitosamente");
    }

    @DeleteMapping("/github")
    public ResponseEntity<Map<String, Object>> deleteGitHubCredential(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        gitHubCredentialRepository.findByTenantId(user.getTenant().getId())
                .ifPresent(gitHubCredentialRepository::delete);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "REVOKE_GITHUB", "Personal Access Token de GitHub revocado y eliminado");
        return ResponseEntity.ok(Map.of("message", "Credenciales de GitHub eliminadas exitosamente", "connected", false));
    }

    @DeleteMapping("/revoke-all")
    @Transactional
    public ResponseEntity<Map<String, Object>> revokeAllCredentials(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        List<LinkedInCredential> accounts = linkedInCredentialRepository.findByTenantIdOrderByCreatedAtAsc(user.getTenant().getId());
        linkedInCredentialRepository.deleteAll(accounts);

        gitHubCredentialRepository.findByTenantId(user.getTenant().getId())
                .ifPresent(gitHubCredentialRepository::delete);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "REVOKE_ALL_CREDENTIALS", "Todas las credenciales (LinkedIn y GitHub) fueron revocadas y eliminadas en un clic");

        return ResponseEntity.ok(Map.of(
                "message", "Todas las credenciales conectadas fueron revocadas y eliminadas con éxito",
                "connected", false
        ));
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private ResponseEntity<Map<String, Object>> processSaveLinkedIn(Authentication auth, LinkedInTokenRequest request, String successMessage) {
        User user = authHelper.getCurrentUser(auth);
        LocalDateTime now = LocalDateTime.now();
        int days = request.expiresInDays() != null ? request.expiresInDays() : 60;
        String rawToken = request.accessToken().trim();

        // Validación de API de LinkedIn antes de insertar
        Map<String, String> discovered = linkedInPublisherService.validateAndDiscoverPersonAccount(rawToken);
        String personUrn = discovered.get("authorUrn");
        String displayName = discovered.get("displayName");

        Optional<LinkedInCredential> existingOpt = linkedInCredentialRepository.findByTenantIdAndAuthorUrn(user.getTenant().getId(), personUrn);
        LinkedInCredential cred = existingOpt.orElseGet(() -> LinkedInCredential.builder()
                .tenant(user.getTenant())
                .accountType(LinkedInAccountType.PERSON)
                .isPrimary(true)
                .isEnabled(true)
                .build());

        cred.setAccessTokenEnc(encryptionService.encrypt(rawToken));
        cred.setAuthorUrn(personUrn);
        cred.setPersonUrn(personUrn);
        cred.setDisplayName(displayName);
        cred.setTokenIssuedAt(now);
        cred.setTokenExpiresAt(now.plusDays(days));
        cred.setIsValid(true);

        linkedInCredentialRepository.save(cred);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "SAVE_LINKEDIN", "Token de LinkedIn registrado (Validez: " + days + " días, URN: " + personUrn + ")");

        return ResponseEntity.ok(Map.of(
                "message", successMessage,
                "connected", true,
                "personUrn", cred.getEffectiveAuthorUrn(),
                "displayName", cred.getDisplayName(),
                "expiresAt", cred.getTokenExpiresAt(),
                "status", "ACTIVE"
        ));
    }

    private ResponseEntity<Map<String, Object>> processSaveGitHub(Authentication auth, GitHubTokenRequest request, String successMessage) {
        User user = authHelper.getCurrentUser(auth);
        String username = request.githubUsername();

        if (username == null || username.isBlank()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> userResponse = gitHubWebClient.get()
                        .uri("/user")
                        .header("Authorization", "Bearer " + request.personalAccessToken())
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block();

                if (userResponse != null && userResponse.containsKey("login")) {
                    username = userResponse.get("login").toString();
                }
            } catch (Exception e) {
                log.warn("No se pudo autodescubrir username via /user: {}", e.getMessage());
            }
        }

        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("No se pudo resolver el nombre de usuario de GitHub.");
        }

        Optional<GitHubCredential> existingOpt = gitHubCredentialRepository.findByTenantId(user.getTenant().getId());
        GitHubCredential cred = existingOpt.orElseGet(() -> GitHubCredential.builder()
                .tenant(user.getTenant())
                .build());

        cred.setPersonalAccessTokenEnc(encryptionService.encrypt(request.personalAccessToken()));
        cred.setGithubUsername(username);
        cred.setIsValid(true);

        gitHubCredentialRepository.save(cred);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "SAVE_GITHUB", "PAT de GitHub registrado para usuario: " + username);

        return ResponseEntity.ok(Map.of(
                "message", successMessage,
                "connected", true,
                "username", cred.getGithubUsername(),
                "status", "ACTIVE"
        ));
    }

    private LinkedInAccountResponse mapToAccountResponse(LinkedInCredential cred) {
        boolean isExpired = cred.getTokenExpiresAt().isBefore(LocalDateTime.now());
        long daysRemaining = Math.max(0, Duration.between(LocalDateTime.now(), cred.getTokenExpiresAt()).toDays());

        String status = isExpired ? "EXPIRED" : (!Boolean.TRUE.equals(cred.getIsEnabled()) ? "DISABLED" : (daysRemaining <= 7 ? "EXPIRING_SOON" : "ACTIVE"));

        return new LinkedInAccountResponse(
                cred.getId(),
                cred.getAccountType(),
                cred.getEffectiveAuthorUrn(),
                cred.getDisplayName() != null ? cred.getDisplayName() : (cred.getAccountType() == LinkedInAccountType.PERSON ? "Perfil Personal" : "Página de Empresa"),
                cred.getVanityName(),
                cred.getMaxPostsPerDay() != null ? cred.getMaxPostsPerDay() : 1,
                cred.getIsEnabled(),
                cred.getIsPrimary(),
                cred.getIsValid() && !isExpired,
                cred.getTokenExpiresAt(),
                daysRemaining,
                status,
                cred.getCreatedAt()
        );
    }
}
