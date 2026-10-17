package com.deyvid.backend.service;

import com.deyvid.backend.entity.*;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.repository.*;
import com.deyvid.backend.service.ai.ImageGeneratorService;
import com.deyvid.backend.service.linkedin.LinkedInPublisherService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ApprovedPublicationService {
    private final TenantRepository tenants;
    private final DraftPreviewRepository drafts;
    private final LinkedInCredentialRepository accounts;
    private final PublicationLogRepository logs;
    private final PublicationLogService logService;
    private final PublicationAttemptService attempts;
    private final ImageGeneratorService images;
    private final LinkedInPublisherService publisher;

    public record Result(String outcome, int publishedCount, String message) {}

    @Transactional
    public Result publish(UUID tenantId, UUID requestedDraftId) {
        // Serializes HTTP, Quartz and Actions executions for the same tenant, including across replicas.
        Tenant tenant = tenants.findByIdForUpdate(tenantId).orElseThrow(() -> new IllegalArgumentException("Cuenta no disponible"));
        if (!Boolean.TRUE.equals(tenant.getIsActive()) || Boolean.TRUE.equals(tenant.getIsEmergencyPaused())) {
            return new Result("PAUSED", 0, "La automatización está pausada");
        }
        Optional<DraftPreview> selected = requestedDraftId == null
                ? drafts.findFirstByTenantIdAndIsQueuedTrueOrderByCreatedAtAsc(tenantId)
                : drafts.findByIdAndTenantId(requestedDraftId, tenantId);
        if (selected.isEmpty()) return new Result("EMPTY", 0, "No hay publicaciones aprobadas en la cola");
        DraftPreview draft = drafts.findOwnedForUpdate(selected.get().getId(), tenantId).orElseThrow(() -> new IllegalArgumentException("Borrador no disponible"));
        if (!draft.isQueued()) throw new IllegalArgumentException("Aprueba el borrador antes de publicar");
        if (draft.getGeneratedText() == null || draft.getGeneratedText().isBlank()) throw new IllegalArgumentException("El borrador está vacío");
        List<LinkedInCredential> targets = accounts.findByTenantIdAndIsEnabledTrue(tenantId).stream()
                .filter(a -> draft.getTargetCredentialId() == null || a.getId().equals(draft.getTargetCredentialId())).toList();
        if (targets.isEmpty()) return new Result("NO_ACCOUNT", 0, "La cuenta de destino está desconectada o deshabilitada");
        if (Boolean.TRUE.equals(tenant.getIsDryRun())) return new Result("SIMULATED", 0, "Simulación: el post sigue en la cola y no se envió a LinkedIn");

        Instant dayStart = LocalDate.now(ZoneId.of(tenant.getTimezone())).atStartOfDay(ZoneId.of(tenant.getTimezone())).toInstant();
        byte[] bytes = draft.getImageUrl() == null || draft.getImageUrl().isBlank() ? null : images.fetchBytesFromUrl(draft.getImageUrl());
        int published = 0;
        boolean complete = true;
        for (LinkedInCredential account : targets) {
            if (attempts.succeeded(draft.getId(), account.getId())) continue;
            int max = account.getMaxPostsPerDay() == null ? 1 : account.getMaxPostsPerDay();
            if (attempts.countReserved(tenantId, account.getEffectiveAuthorUrn(), dayStart) >= max) {
                complete = false;
                continue;
            }
            if (!attempts.claim(tenantId, draft.getId(), account.getId(), account.getEffectiveAuthorUrn())) {
                complete = false; // A prior attempt may have reached LinkedIn. Never retry it automatically.
                continue;
            }
            long start = System.currentTimeMillis();
            String urn;
            try {
                urn = publisher.publishSingleAccount(tenant, account, draft.getGeneratedText(), bytes);
                attempts.finish(draft.getId(), account.getId(), "SUCCESS", urn);
            } catch (Exception e) {
                attempts.finish(draft.getId(), account.getId(), "UNKNOWN", null);
                complete = false;
                logService.createLog(tenant, draft.getSourceMode(), PublicationStatus.FAILED, account.getAccountType(), account.getEffectiveAuthorUrn(),
                        draft.getGeneratedText(), draft.getImageUrl(), null, draft.getSourceReference(),
                        "Revisa LinkedIn antes de reintentar: no se pudo confirmar el resultado del envío.", System.currentTimeMillis() - start, null, null);
                continue;
            }
            published++;
            logService.createLog(tenant, draft.getSourceMode(), PublicationStatus.SUCCESS, account.getAccountType(), account.getEffectiveAuthorUrn(),
                    draft.getGeneratedText(), draft.getImageUrl(), urn, draft.getSourceReference(), null, System.currentTimeMillis() - start, null, null);
        }
        if (complete) drafts.delete(draft);
        return new Result(complete ? "PUBLISHED" : "REVIEW_REQUIRED", published,
                complete ? "Publicación completada" : "El post sigue en cola. Revisa el límite diario y el historial antes de reintentar.");
    }
}
