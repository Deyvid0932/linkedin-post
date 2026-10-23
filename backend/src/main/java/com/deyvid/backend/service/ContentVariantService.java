package com.deyvid.backend.service;

import com.deyvid.backend.dto.request.ContentAdaptRequest;
import com.deyvid.backend.dto.request.SaveContentVariantRequest;
import com.deyvid.backend.dto.response.ContentVariantResponse;
import com.deyvid.backend.entity.ContentVariant;
import com.deyvid.backend.repository.ContentVariantRepository;
import com.deyvid.backend.repository.DraftPreviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContentVariantService {
    private final ContentVariantRepository variants;
    private final DraftPreviewRepository drafts;
    private final PublicationAttemptService attempts;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<ContentVariantResponse> list(UUID tenantId, UUID draftId) {
        var draft = drafts.findByIdAndTenantId(draftId, tenantId)
                .filter(item -> !item.isPreview())
                .orElseThrow(() -> new IllegalArgumentException("Borrador no disponible"));
        return variants.findByDraft_IdAndTenant_IdOrderByUpdatedAtDesc(draft.getId(), tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public ContentVariantResponse save(UUID tenantId, UUID draftId, String actorEmail,
                                       SaveContentVariantRequest request) {
        var draft = drafts.findOwnedForUpdate(draftId, tenantId)
                .filter(item -> !item.isPreview())
                .orElseThrow(() -> new IllegalArgumentException("Borrador no disponible"));
        if (draft.isQueued()) {
            throw new IllegalArgumentException("Retira el borrador de la cola antes de guardar variantes");
        }
        if (attempts.hasAttempts(draftId)) {
            throw new IllegalArgumentException("Este borrador ya tiene un intento de publicación y no admite cambios");
        }
        String text = request.text().trim();
        int configuredTarget = draft.getTenant().getAppTargetCharacters() == null
                ? 1200 : draft.getTenant().getAppTargetCharacters();
        int maxCharacters = Math.min(configuredTarget, request.channel().recommendedCharacters());
        if (text.length() > maxCharacters) {
            throw new IllegalArgumentException("La variante supera el objetivo de " + maxCharacters + " caracteres");
        }

        ContentVariant variant = variants.findByDraft_IdAndTenant_IdAndChannel(
                        draftId, tenantId, request.channel())
                .orElseGet(() -> ContentVariant.builder()
                        .tenant(draft.getTenant()).draft(draft).channel(request.channel()).build());
        variant.setContentText(text);
        ContentVariant saved = variants.save(variant);
        auditLogService.recordAction(draft.getTenant(), actorEmail, "CONTENT_VARIANT_SAVED",
                "Variante editorial guardada para " + request.channel().label());
        return toResponse(saved);
    }

    private ContentVariantResponse toResponse(ContentVariant variant) {
        int configuredTarget = variant.getTenant().getAppTargetCharacters() == null
                ? 1200 : variant.getTenant().getAppTargetCharacters();
        int target = Math.min(configuredTarget, variant.getChannel().recommendedCharacters());
        return new ContentVariantResponse(variant.getId(), variant.getChannel().name(),
                variant.getContentText(), variant.getContentText().length(), target, variant.getUpdatedAt());
    }
}
