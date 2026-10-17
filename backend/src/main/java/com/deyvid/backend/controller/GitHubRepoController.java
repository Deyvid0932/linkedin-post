package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.GitHubRepoRequest;
import com.deyvid.backend.dto.response.GitHubRepoResponse;
import com.deyvid.backend.entity.GitHubCredential;
import com.deyvid.backend.entity.GitHubRepository;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.GitHubCredentialRepository;
import com.deyvid.backend.repository.GitHubRepositoryRepo;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.EncryptionService;
import com.deyvid.backend.service.GitHubLinkedInBindingService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/github/repos")
@Slf4j
public class GitHubRepoController {

    private final AuthHelper authHelper;
    private final GitHubRepositoryRepo gitHubRepositoryRepo;
    private final GitHubCredentialRepository gitHubCredentialRepository;
    private final EncryptionService encryptionService;
    private final AuditLogService auditLogService;
    private final WebClient gitHubWebClient;
    private final GitHubLinkedInBindingService githubBindings;

    public GitHubRepoController(
            AuthHelper authHelper,
            GitHubRepositoryRepo gitHubRepositoryRepo,
            GitHubCredentialRepository gitHubCredentialRepository,
            EncryptionService encryptionService,
            AuditLogService auditLogService,
            GitHubLinkedInBindingService githubBindings,
            @Qualifier("gitHubWebClient") WebClient gitHubWebClient) {
        this.authHelper = authHelper;
        this.gitHubRepositoryRepo = gitHubRepositoryRepo;
        this.gitHubCredentialRepository = gitHubCredentialRepository;
        this.encryptionService = encryptionService;
        this.auditLogService = auditLogService;
        this.githubBindings = githubBindings;
        this.gitHubWebClient = gitHubWebClient;
    }

    @GetMapping
    public ResponseEntity<List<GitHubRepoResponse>> getRepos(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        List<GitHubRepository> repos = gitHubRepositoryRepo.findByTenantIdAndIsActiveTrue(user.getTenant().getId());

        List<GitHubRepoResponse> response = repos.stream()
                .map(this::mapToResponse)
                .toList();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<GitHubRepoResponse> getRepoById(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        GitHubRepository repo = gitHubRepositoryRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Repositorio no encontrado"));

        if (!repo.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        return ResponseEntity.ok(mapToResponse(repo));
    }

    @PostMapping
    public ResponseEntity<GitHubRepoResponse> addRepo(Authentication auth, @Valid @RequestBody GitHubRepoRequest request) {
        User user = authHelper.getCurrentUser(auth);

        GitHubRepository repo = gitHubRepositoryRepo.findByTenantIdAndRepoOwnerAndRepoName(user.getTenant().getId(), request.repoOwner(), request.repoName())
                .orElseGet(() -> GitHubRepository.builder()
                        .tenant(user.getTenant())
                        .repoOwner(request.repoOwner())
                        .repoName(request.repoName())
                        .isActive(true)
                        .build());

        repo.setIsActive(true);
        repo.setLastCheckedAt(LocalDateTime.now());
        GitHubRepository saved = gitHubRepositoryRepo.save(repo);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "ADD_GITHUB_REPO", "Repositorio conectado: " + request.repoOwner() + "/" + request.repoName());

        return ResponseEntity.ok(mapToResponse(saved));
    }

    @PostMapping("/{id}/sync")
    public ResponseEntity<GitHubRepoResponse> syncRepo(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        GitHubRepository repo = gitHubRepositoryRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Repositorio no encontrado"));

        if (!repo.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        GitHubCredential cred = gitHubCredentialRepository.findByTenantId(user.getTenant().getId())
                .orElseThrow(() -> new IllegalArgumentException("Se requiere una credencial de GitHub configurada para sincronizar"));

        String token = encryptionService.decrypt(cred.getPersonalAccessTokenEnc());

        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> commits = gitHubWebClient.get()
                    .uri("/repos/{owner}/{repo}/commits?per_page=1", repo.getRepoOwner(), repo.getRepoName())
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .bodyToMono(List.class)
                    .block();

            if (commits != null && !commits.isEmpty()) {
                Map<String, Object> latest = commits.get(0);
                String sha = (String) latest.get("sha");
                repo.setLastCommitSha(sha);
            }
        } catch (Exception e) {
            log.warn("Error al sincronizar commits para {}/{}: {}", repo.getRepoOwner(), repo.getRepoName(), e.getMessage());
        }

        repo.setLastCheckedAt(LocalDateTime.now());
        GitHubRepository saved = gitHubRepositoryRepo.save(repo);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "SYNC_GITHUB_REPO", "Sincronizado manual de " + repo.getRepoOwner() + "/" + repo.getRepoName());

        return ResponseEntity.ok(mapToResponse(saved));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<GitHubRepoResponse> updateRepo(Authentication auth, @PathVariable UUID id, @Valid @RequestBody GitHubRepoRequest request) {
        User user = authHelper.getCurrentUser(auth);
        GitHubRepository repo = gitHubRepositoryRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Repositorio no encontrado"));

        if (!repo.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        githubBindings.disconnectIfBound(user.getTenant().getId(), id);
        repo.setRepoOwner(request.repoOwner());
        repo.setRepoName(request.repoName());
        GitHubRepository saved = gitHubRepositoryRepo.save(repo);

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "UPDATE_GITHUB_REPO", "Repositorio actualizado a " + request.repoOwner() + "/" + request.repoName());

        return ResponseEntity.ok(mapToResponse(saved));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteRepo(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        GitHubRepository repo = gitHubRepositoryRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Repositorio no encontrado"));

        if (!repo.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        githubBindings.disconnectIfBound(user.getTenant().getId(), id);
        gitHubRepositoryRepo.delete(repo);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "DELETE_GITHUB_REPO", "Repositorio desconectado: " + repo.getRepoOwner() + "/" + repo.getRepoName());

        return ResponseEntity.noContent().build();
    }

    private GitHubRepoResponse mapToResponse(GitHubRepository repo) {
        return new GitHubRepoResponse(
                repo.getId(),
                repo.getRepoOwner(),
                repo.getRepoName(),
                repo.getLastCheckedAt(),
                repo.getLastCommitSha(),
                repo.getIsActive(),
                repo.getCreatedAt()
        );
    }
}
