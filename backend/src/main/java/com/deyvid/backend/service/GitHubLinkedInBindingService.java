package com.deyvid.backend.service;

import com.deyvid.backend.entity.GitHubLinkedInBinding;
import com.deyvid.backend.repository.GitHubLinkedInBindingRepository;
import com.deyvid.backend.repository.GitHubRepositoryRepo;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GitHubLinkedInBindingService {
    private final GitHubLinkedInBindingRepository bindings;
    private final GitHubRepositoryRepo repositories;
    private final LinkedInCredentialRepository accounts;
    private final GitHubActionsCredentialService actions;

    public record BindingView(UUID repositoryId, String repository, UUID accountId, String accountName,
                              String status, Instant lastSyncedAt, String errorCode) {}

    @Transactional(readOnly = true)
    public BindingView get(UUID tenantId, UUID repositoryId) {
        var binding = binding(tenantId, repositoryId);
        return view(binding);
    }

    @Transactional
    public BindingView save(UUID tenantId, UUID repositoryId, UUID accountId) {
        var repository = repositories.findById(repositoryId).filter(r -> r.getTenant().getId().equals(tenantId) && Boolean.TRUE.equals(r.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("Repositorio no disponible para este espacio"));
        var account = accounts.findById(accountId).filter(a -> a.getTenant().getId().equals(tenantId)
                        && Boolean.TRUE.equals(a.getIsEnabled()) && Boolean.TRUE.equals(a.getIsValid())
                        && a.getAccountType() == com.deyvid.backend.entity.enums.LinkedInAccountType.PERSON)
                .orElseThrow(() -> new IllegalArgumentException("Selecciona un perfil personal de LinkedIn activo"));
        var binding = bindings.findByTenantIdAndRepositoryId(tenantId, repositoryId).orElseGet(() ->
                GitHubLinkedInBinding.builder().tenant(repository.getTenant()).repository(repository).build());
        binding.setLinkedInCredential(account);
        binding.setSyncStatus("PENDING"); binding.setLastError(null);
        return synchronize(bindings.save(binding));
    }

    @Transactional
    public BindingView retry(UUID tenantId, UUID repositoryId) { return synchronize(binding(tenantId, repositoryId)); }

    @Transactional
    public void disconnect(UUID tenantId, UUID repositoryId) {
        var binding = binding(tenantId, repositoryId);
        actions.removeAndPause(binding);
        bindings.delete(binding);
    }

    @Transactional
    public void disconnectIfBound(UUID tenantId, UUID repositoryId) {
        bindings.findByTenantIdAndRepositoryId(tenantId, repositoryId).ifPresent(binding -> {
            actions.removeAndPause(binding);
            bindings.delete(binding);
        });
    }

    @Transactional
    public void disconnectTenant(UUID tenantId) {
        for (var binding : bindings.findByTenantId(tenantId)) {
            actions.removeAndPause(binding);
            bindings.delete(binding);
        }
    }

    @Transactional
    public void disconnectAccount(UUID accountId) {
        for (var binding : bindings.findByLinkedInCredentialId(accountId)) {
            actions.removeAndPause(binding);
            bindings.delete(binding);
        }
    }

    @Transactional
    public void syncConnectedAccount(UUID accountId) {
        for (var binding : bindings.findByLinkedInCredentialId(accountId)) synchronize(binding);
    }

    @Transactional
    public void pauseAccount(UUID accountId) {
        for (var binding : bindings.findByLinkedInCredentialId(accountId)) actions.pause(binding);
    }

    private BindingView synchronize(GitHubLinkedInBinding binding) {
        try {
            actions.sync(binding);
            binding.setSyncStatus("SYNCED"); binding.setLastSyncedAt(Instant.now()); binding.setLastError(null);
        } catch (Exception ex) {
            binding.setSyncStatus("PENDING");
            binding.setLastError(errorCode(ex));
        }
        return view(bindings.save(binding));
    }

    private GitHubLinkedInBinding binding(UUID tenantId, UUID repositoryId) {
        return bindings.findByTenantIdAndRepositoryId(tenantId, repositoryId)
                .orElseThrow(() -> new IllegalArgumentException("Este repositorio aún no tiene una cuenta de LinkedIn vinculada"));
    }

    private static String errorCode(Exception error) {
        String message = error.getMessage();
        if (message != null && message.contains("GITHUB_NOT_CONNECTED")) return "GITHUB_NOT_CONNECTED";
        if (message != null && message.contains("GITHUB_ENCRYPTION_FAILED")) return "GITHUB_ENCRYPTION_FAILED";
        if (error instanceof org.springframework.web.reactive.function.client.WebClientResponseException response) return "GITHUB_HTTP_" + response.getStatusCode().value();
        return "GITHUB_SYNC_FAILED";
    }

    private static BindingView view(GitHubLinkedInBinding binding) {
        return new BindingView(binding.getRepository().getId(), binding.getRepository().getRepoOwner() + "/" + binding.getRepository().getRepoName(),
                binding.getLinkedInCredential().getId(), binding.getLinkedInCredential().getDisplayName(), binding.getSyncStatus(),
                binding.getLastSyncedAt(), binding.getLastError());
    }
}
