package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.GeneratedPreviewResponse;
import com.deyvid.backend.entity.DraftPreview;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.exception.PipelineExecutionException;
import com.deyvid.backend.repository.DraftPreviewRepository;
import com.deyvid.backend.repository.TenantRepository;
import com.deyvid.backend.service.ai.ContentGeneratorService;
import com.deyvid.backend.service.ai.ImageGeneratorService;
import com.deyvid.backend.service.pipeline.ContentPipelineService;
import com.deyvid.backend.service.linkedin.ContentSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DraftPreviewService {

    private final DraftPreviewRepository draftPreviewRepository;
    private final TenantRepository tenantRepository;
    private final ContentPipelineService contentPipelineService;
    private final ContentGeneratorService contentGeneratorService;
    private final ImageGeneratorService imageGeneratorService;

    @Transactional(readOnly = true)
    public GeneratedPreviewResponse getSaved(UUID tenantId) {
        try {
            return draftPreviewRepository.findFirstByTenantIdAndIsPreviewTrueAndIsQueuedFalseOrderByUpdatedAtDesc(tenantId)
                    .map(this::toResponse)
                    .orElseGet(() -> new GeneratedPreviewResponse(
                            SourceMode.PROJECT,
                            "",
                            "",
                            ""
                    ));
        } catch (Exception e) {
            log.warn("Error al recuperar borrador persistido para tenant {}: {}", tenantId, e.getMessage());
            return new GeneratedPreviewResponse(SourceMode.PROJECT, "", "", "");
        }
    }

    @Transactional
    public GeneratedPreviewResponse generate(UUID tenantId) {
        return generate(tenantId, null);
    }

    @Transactional
    public GeneratedPreviewResponse generate(UUID tenantId, ContentSource customSource) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new PipelineExecutionException("Tenant no encontrado con ID: " + tenantId));

        ContentSource source = customSource != null ? customSource : contentPipelineService.previewPipelineSource(tenantId);
        String postText = contentGeneratorService.generatePostContent(tenant, source);
        ImageGeneratorService.ImageData imageData = imageGeneratorService.generateOrFetchImage(source, postText);

        DraftPreview preview = draftPreviewRepository.findFirstByTenantIdAndIsPreviewTrueAndIsQueuedFalseOrderByUpdatedAtDesc(tenantId)
                .orElseGet(() -> DraftPreview.builder().tenant(tenant).isPreview(true).sourceMode(SourceMode.PROJECT).build());

        preview.setSourceMode(source.mode() != null ? source.mode() : SourceMode.PROJECT);
        preview.setGeneratedText(postText);
        preview.setImageUrl(imageData.imageUrl());
        preview.setSourceReference(source.referenceUrl());

        DraftPreview saved = draftPreviewRepository.save(preview);
        return toResponse(saved);
    }

    @Transactional
    public GeneratedPreviewResponse updateDraft(UUID tenantId, String text, String imageUrl) {
        new SafeImageService().validate(imageUrl);
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new PipelineExecutionException("Tenant no encontrado con ID: " + tenantId));

            DraftPreview preview = draftPreviewRepository.findFirstByTenantIdAndIsPreviewTrueAndIsQueuedFalseOrderByUpdatedAtDesc(tenantId)
                    .orElseGet(() -> DraftPreview.builder()
                            .tenant(tenant).isPreview(true)
                            .sourceMode(SourceMode.PROJECT)
                            .build());

            if (preview.getSourceMode() == null) {
                preview.setSourceMode(SourceMode.PROJECT);
            }

            if (text != null && !text.isBlank()) {
                preview.setGeneratedText(text.trim());
            }
            if (imageUrl != null) {
                preview.setImageUrl(imageUrl.trim());
            }

            DraftPreview saved = draftPreviewRepository.save(preview);
            log.info("Borrador previsualizado actualizado exitosamente para tenant {}", tenantId);
            return toResponse(saved);
    }

    private GeneratedPreviewResponse toResponse(DraftPreview preview) {
        return new GeneratedPreviewResponse(
                preview.getSourceMode() != null ? preview.getSourceMode() : SourceMode.PROJECT,
                preview.getGeneratedText() != null ? preview.getGeneratedText() : "",
                preview.getImageUrl() != null ? preview.getImageUrl() : "",
                preview.getSourceReference() != null ? preview.getSourceReference() : ""
        );
    }
}
