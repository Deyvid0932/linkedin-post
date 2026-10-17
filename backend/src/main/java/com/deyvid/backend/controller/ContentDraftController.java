package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.ComposeRequest;
import com.deyvid.backend.entity.*;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.repository.*;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/content")
@RequiredArgsConstructor
public class ContentDraftController {
    private final AuthHelper auth;
    private final DraftPreviewRepository drafts;
    private final LinkedInCredentialRepository accounts;
    private final ComposeService composer;
    private final SafeImageService images;
    private final PublicationAttemptService attempts;

    public record DraftResponse(UUID id, String title, String text, String imageUrl, String tone, String audience, String goal, String instructions,
                                UUID targetCredentialId, boolean queued, LocalDateTime updatedAt) {}
    private DraftResponse response(DraftPreview d) {
        return new DraftResponse(d.getId(), d.getTitle(), d.getGeneratedText(), d.getImageUrl(), d.getTone(), d.getAudience(),
                d.getGoal(), d.getInstructions(), d.getTargetCredentialId(), d.isQueued(), d.getUpdatedAt());
    }

    @GetMapping("/drafts")
    @Transactional(readOnly = true)
    public List<DraftResponse> list(Authentication principal) {
        return drafts.findAllByTenantIdAndIsPreviewFalseOrderByUpdatedAtDesc(auth.getCurrentTenantId(principal)).stream().map(this::response).toList();
    }

    @PostMapping("/generate")
    public ComposeService.Proposal generate(Authentication principal, @Valid @RequestBody ComposeRequest req) {
        return composer.generate(auth.getCurrentUser(principal).getTenant(), req);
    }

    @PostMapping("/drafts")
    public DraftResponse create(Authentication principal, @Valid @RequestBody ComposeRequest req) {
        User user = auth.getCurrentUser(principal);
        var draft = DraftPreview.builder().tenant(user.getTenant()).sourceMode(SourceMode.BACKUP).build();
        apply(draft, req, user.getTenant().getId());
        return response(drafts.save(draft));
    }

    @PutMapping("/drafts/{id}")
    @Transactional
    public DraftResponse update(Authentication principal, @PathVariable UUID id, @Valid @RequestBody ComposeRequest req) {
        UUID tenantId = auth.getCurrentTenantId(principal);
        var draft = drafts.findOwnedForUpdate(id, tenantId).orElseThrow(() -> new IllegalArgumentException("Borrador no disponible"));
        if (draft.isQueued()) throw new IllegalArgumentException("Retira el post de la cola antes de editarlo");
        if (attempts.hasAttempts(id)) throw new IllegalArgumentException("Este post ya tiene un intento de publicación. Revisa LinkedIn y crea un nuevo borrador si necesitas corregirlo.");
        apply(draft, req, tenantId);
        return response(drafts.save(draft));
    }

    private void apply(DraftPreview draft, ComposeRequest req, UUID tenantId) {
        images.validate(req.imageUrl());
        if (req.targetCredentialId() != null) ownedAccount(req.targetCredentialId(), tenantId);
        draft.setTitle(req.title().trim());
        draft.setGeneratedText(Objects.toString(req.text(), "").trim());
        draft.setImageUrl(req.imageUrl());
        draft.setTone(req.tone().name());
        draft.setAudience(req.audience().trim());
        draft.setGoal(req.goal().name());
        draft.setInstructions(req.instructions());
        draft.setSourceReference(req.title().trim());
        draft.setTargetCredentialId(req.targetCredentialId());
    }

    private LinkedInCredential ownedAccount(UUID id, UUID tenantId) {
        return accounts.findById(id).filter(a -> a.getTenant().getId().equals(tenantId) && Boolean.TRUE.equals(a.getIsEnabled()))
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de destino no disponible"));
    }

    @PostMapping("/drafts/{id}/approve")
    @Transactional
    public DraftResponse approve(Authentication principal, @PathVariable UUID id) {
        UUID tenantId = auth.getCurrentTenantId(principal);
        var draft = drafts.findOwnedForUpdate(id, tenantId).orElseThrow(() -> new IllegalArgumentException("Borrador no disponible"));
        if (draft.getGeneratedText() == null || draft.getGeneratedText().isBlank()) throw new IllegalArgumentException("Escribe o genera el texto antes de aprobar");
        if (draft.getTargetCredentialId() == null) throw new IllegalArgumentException("Elige una cuenta de LinkedIn antes de aprobar");
        var account = ownedAccount(draft.getTargetCredentialId(), tenantId);
        draft.setAuthorUrn(account.getEffectiveAuthorUrn());
        draft.setQueued(true);
        return response(drafts.save(draft));
    }

    @PostMapping("/drafts/{id}/unqueue")
    @Transactional
    public DraftResponse unqueue(Authentication principal, @PathVariable UUID id) {
        var draft = drafts.findOwnedForUpdate(id, auth.getCurrentTenantId(principal)).orElseThrow(() -> new IllegalArgumentException("Borrador no disponible"));
        if (attempts.hasAttempts(id)) throw new IllegalArgumentException("Este post ya tiene un intento de envío. Revisa el historial y LinkedIn antes de preparar otro.");
        draft.setQueued(false);
        return response(drafts.save(draft));
    }
}
