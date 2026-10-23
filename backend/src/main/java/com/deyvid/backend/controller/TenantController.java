package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.PromptTestRequest;
import com.deyvid.backend.dto.request.TenantProfileRequest;
import com.deyvid.backend.dto.response.DashboardStatsResponse;
import com.deyvid.backend.dto.response.OnboardingStatusResponse;
import com.deyvid.backend.dto.response.PromptVersionResponse;
import com.deyvid.backend.dto.response.TenantResponse;
import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.PromptVersion;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.repository.PublishingScheduleRepository;
import com.deyvid.backend.repository.TenantRepository;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.TenantService;
import com.deyvid.backend.service.PlatformPublicationPolicyService;
import com.deyvid.backend.service.ComposeService;
import com.deyvid.backend.service.linkedin.ContentSource;
import com.deyvid.backend.entity.enums.SourceMode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/tenant", "/api/v1/tenants"})
@RequiredArgsConstructor
public class TenantController {

    private final AuthHelper authHelper;
    private final TenantRepository tenantRepository;
    private final TenantService tenantService;
    private final PublicationLogRepository publicationLogRepository;
    private final PublishingScheduleRepository scheduleRepository;
    private final LinkedInCredentialRepository linkedInCredentialRepository;
    private final ComposeService composeService;
    private final PlatformPublicationPolicyService publicationPolicyService;

    @GetMapping({"/profile", "/current"})
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<TenantResponse> getProfile(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        UUID tenantId = user.getTenant().getId();
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));
        return ResponseEntity.ok(mapToTenantResponse(t));
    }

    @PutMapping("/profile")
    public ResponseEntity<TenantResponse> updateProfile(Authentication auth, @Valid @RequestBody TenantProfileRequest request) {
        User user = authHelper.getCurrentUser(auth);
        Tenant updated = tenantService.updateTenantProfile(
                user.getTenant().getId(), user.getEmail(), request.systemPrompt(), request.timezone(),
                request.appApprovalMode(), request.appTargetCharacters(), request.appImageModel(),
                request.appTextModel(), "Actualización de configuración");
        return ResponseEntity.ok(mapToTenantResponse(updated));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardStatsResponse> getDashboardStats(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        Tenant tenant = user.getTenant();

        long total = publicationLogRepository.countByTenantIdAndStatus(tenant.getId(), PublicationStatus.SUCCESS) +
                publicationLogRepository.countByTenantIdAndStatus(tenant.getId(), PublicationStatus.FAILED);
        long success = publicationLogRepository.countByTenantIdAndStatus(tenant.getId(), PublicationStatus.SUCCESS);
        long failed = publicationLogRepository.countByTenantIdAndStatus(tenant.getId(), PublicationStatus.FAILED);
        long activeSchedules = scheduleRepository.findByTenantIdAndIsActiveTrue(tenant.getId()).size();

        Optional<LinkedInCredential> credOpt = linkedInCredentialRepository.findByTenantId(tenant.getId());
        boolean connected = credOpt.isPresent() && credOpt.get().getIsValid() && credOpt.get().getTokenExpiresAt().isAfter(LocalDateTime.now());
        long daysRemaining = 0;

        if (credOpt.isPresent() && credOpt.get().getTokenExpiresAt() != null) {
            daysRemaining = Math.max(0, Duration.between(LocalDateTime.now(), credOpt.get().getTokenExpiresAt()).toDays());
        }

        return ResponseEntity.ok(new DashboardStatsResponse(total, success, failed, activeSchedules, connected, daysRemaining));
    }

    @GetMapping("/onboarding-status")
    public ResponseEntity<OnboardingStatusResponse> getOnboardingStatus(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(tenantService.getOnboardingStatus(user.getTenant().getId()));
    }

    @PostMapping("/prompt/test")
    public ResponseEntity<Map<String, Object>> testPrompt(Authentication auth, @Valid @RequestBody PromptTestRequest request) {
        User user = authHelper.getCurrentUser(auth);
        Tenant tenant = user.getTenant();

        // Prueba con el mismo servicio que usa Crear publicación; no persiste ni publica.
        Tenant tempTenant = Tenant.builder()
                .id(tenant.getId())
                .systemPrompt(request.testPrompt())
                .timezone(tenant.getTimezone())
                .appTargetCharacters(tenant.getAppTargetCharacters())
                .appImageModel(tenant.getAppImageModel())
                .appTextModel(tenant.getAppTextModel())
                .build();

        String topic = (request.sampleTopic() != null && !request.sampleTopic().isBlank())
                ? request.sampleTopic()
                : "Optimización de Pipelines de Software y Productividad";

        ContentSource source = new ContentSource(
                SourceMode.RESEARCH,
                topic,
                "Detalles de prueba simulada para validar la fidelidad del estilo del prompt.",
                null,
                "https://ejemplo.com/recurso-prueba"
        );

        var generatedSample = composeService.generate(tempTenant, new com.deyvid.backend.dto.request.ComposeRequest(
                topic, source.rawContent(), com.deyvid.backend.dto.request.ComposeRequest.Tone.PROFESSIONAL,
                "Profesionales de LinkedIn", com.deyvid.backend.dto.request.ComposeRequest.Goal.SHARE_LEARNING,
                "Ejemplo de prueba de voz. No inventes hechos personales.", null, null));
        String approach = request.approach() != null ? request.approach() : "PROFESSIONAL";

        return ResponseEntity.ok(Map.of(
                "success", true,
                "approach", approach,
                "topic", topic,
                "generatedSample", generatedSample.text()
        ));
    }

    @GetMapping("/prompt/versions")
    public ResponseEntity<List<PromptVersionResponse>> getPromptVersions(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        List<PromptVersion> list = tenantService.getPromptVersions(user.getTenant().getId());

        List<PromptVersionResponse> response = list.stream()
                .map(pv -> new PromptVersionResponse(
                        pv.getId(),
                        pv.getVersionNumber(),
                        pv.getPromptText(),
                        pv.getChangeNotes(),
                        pv.getCreatedBy(),
                        pv.getCreatedAt()
                ))
                .toList();

        return ResponseEntity.ok(response);
    }

    @PostMapping("/prompt/rollback/{versionId}")
    public ResponseEntity<TenantResponse> rollbackPrompt(Authentication auth, @PathVariable UUID versionId) {
        User user = authHelper.getCurrentUser(auth);
        Tenant restored = tenantService.rollbackPromptVersion(user.getTenant().getId(), versionId, user.getEmail());
        return ResponseEntity.ok(mapToTenantResponse(restored));
    }

    @PatchMapping("/dry-run")
    public ResponseEntity<Map<String, Object>> toggleDryRun(Authentication auth, @RequestBody Map<String, Boolean> body) {
        User user = authHelper.getCurrentUser(auth);
        boolean dryRun = body.getOrDefault("isDryRun", true);
        Tenant updated = tenantService.setDryRunMode(user.getTenant().getId(), user.getEmail(), dryRun);
        return ResponseEntity.ok(Map.of(
                "message", "Modo Simulación (Dry-Run) configurado a " + (updated.getIsDryRun() ? "ACTIVADO" : "DESACTIVADO"),
                "isDryRun", updated.getIsDryRun()
        ));
    }

    @PostMapping("/emergency-pause")
    public ResponseEntity<Map<String, Object>> emergencyPause(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        tenantService.setEmergencyPause(user.getTenant().getId(), user.getEmail(), true);
        return ResponseEntity.ok(Map.of(
                "message", "¡PAUSA DE EMERGENCIA ACTIVADA! Todos los horarios automáticos se encuentran suspendidos.",
                "isEmergencyPaused", true
        ));
    }

    @PostMapping("/emergency-resume")
    public ResponseEntity<Map<String, Object>> emergencyResume(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        tenantService.setEmergencyPause(user.getTenant().getId(), user.getEmail(), false);
        return ResponseEntity.ok(Map.of(
                "message", "Pausa de emergencia desactivada. Los horarios de publicación automáticos han sido reactivados.",
                "isEmergencyPaused", false
        ));
    }

    private TenantResponse mapToTenantResponse(Tenant t) {
        return new TenantResponse(
                t.getId(),
                t.getSystemPrompt(),
                t.getTimezone(),
                t.getIsActive(),
                t.getIsEmergencyPaused(),
                t.getIsDryRun(),
                t.getCreatedAt(),
                t.getAppApprovalMode(),
                t.getAppTargetCharacters(),
                t.getAppImageModel(),
                t.getAppTextModel(),
                publicationPolicyService.getPolicy().approvalRequired()
        );
    }
}
