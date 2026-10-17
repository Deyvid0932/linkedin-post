package com.deyvid.backend.service.pipeline;

import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.exception.PipelineExecutionException;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.repository.TenantRepository;
import com.deyvid.backend.service.NotificationService;
import com.deyvid.backend.service.PublicationLogService;
import com.deyvid.backend.service.ai.ContentGeneratorService;
import com.deyvid.backend.service.ai.ImageGeneratorService;
import com.deyvid.backend.service.linkedin.LinkedInPublisherService;
import com.deyvid.backend.service.source.BackupTopicService;
import com.deyvid.backend.service.linkedin.ContentSource;
import com.deyvid.backend.service.source.GitHubSourceService;
import com.deyvid.backend.service.source.ResearchSourceService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContentPipelineService {

    private final TenantRepository tenantRepository;
    private final com.deyvid.backend.repository.DraftPreviewRepository draftPreviewRepository;
    private final LinkedInCredentialRepository linkedInCredentialRepository;
    private final GitHubSourceService gitHubSourceService;
    private final ResearchSourceService researchSourceService;
    private final BackupTopicService backupTopicService;
    private final ContentGeneratorService contentGeneratorService;
    private final ImageGeneratorService imageGeneratorService;
    private final LinkedInPublisherService linkedInPublisherService;
    private final PublicationLogService publicationLogService;
    private final com.deyvid.backend.repository.PublicationLogRepository publicationLogRepository;
    private final NotificationService notificationService;

    private final com.deyvid.backend.service.ApprovedPublicationService approvedPublicationService;

    public com.deyvid.backend.service.ApprovedPublicationService.Result executePipelineForTenant(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new PipelineExecutionException("Tenant no encontrado con ID: " + tenantId));
        if (!Boolean.TRUE.equals(tenant.getIsActive()) || Boolean.TRUE.equals(tenant.getIsEmergencyPaused())) {
            return new com.deyvid.backend.service.ApprovedPublicationService.Result("PAUSED", 0, "La automatización está pausada");
        }

        ContentSource source = previewPipelineSource(tenantId);
        if (source == null) source = deriveAutonomousSource(tenant);
        int targetLength = tenant.getAppTargetCharacters() == null ? 1200 : tenant.getAppTargetCharacters();
        String generated = contentGeneratorService.generateVersionWithApproach(
                tenant, source, "COMPARATIVE_B2B", "CUSTOM_" + targetLength);
        ImageGeneratorService.ImageData image = imageGeneratorService.generateOrFetchImage(source, generated,
                tenant.getAppImageModel());

        List<LinkedInCredential> targets = linkedInCredentialRepository.findByTenantIdAndIsEnabledTrue(tenantId);
        LinkedInCredential target = targets.stream().filter(a -> Boolean.TRUE.equals(a.getIsPrimary())).findFirst()
                .orElse(targets.isEmpty() ? null : targets.get(0));
        boolean automatic = "AUTOMATIC".equals(tenant.getAppApprovalMode());
        boolean canAutoPublish = automatic && target != null;
        var draft = com.deyvid.backend.entity.DraftPreview.builder()
                .tenant(tenant)
                .sourceMode(source.mode() != null ? source.mode() : SourceMode.RESEARCH)
                .generatedText(generated)
                .imageUrl(image != null ? image.imageUrl() : null)
                .sourceReference(source.referenceUrl())
                .title(source.title() != null && source.title().length() > 200 ? source.title().substring(0, 200) : source.title())
                .tone("PROFESSIONAL")
                .audience("Mi comunidad profesional")
                .goal("SHARE_LEARNING")
                .targetCredentialId(target != null ? target.getId() : null)
                .authorUrn(target != null ? target.getEffectiveAuthorUrn() : null)
                .isPreview(false)
                .isQueued(canAutoPublish)
                .build();
        var saved = draftPreviewRepository.save(draft);

        if (!automatic) return new com.deyvid.backend.service.ApprovedPublicationService.Result(
                "REVIEW_REQUIRED", 0, "El contenido quedó guardado para revisión y aprobación.");
        if (target == null) return new com.deyvid.backend.service.ApprovedPublicationService.Result(
                "NO_ACCOUNT", 0, "El contenido quedó guardado; conecta una cuenta de LinkedIn antes de publicar automáticamente.");
        return approvedPublicationService.publish(tenantId, saved.getId());
    }

    private static final List<String> PIPELINE_CIVIL_TOPICS = List.of(
            "Control de Calidad y Resistencia de Materiales en Estructuras de Concreto",
            "Gestión y Planificación de Obras Civiles: Mitigación de Sobrecostos y Tiempos",
            "Seguridad Estructural y Normativa Técnica en Edificaciones Modernas",
            "BIM y Supervisión Técnica Digitalizada en Proyectos de Construcción",
            "Tecnología de Concretos Especiales y Pruebas de Carga en Campo"
    );

    private static final List<String> PIPELINE_SOFTWARE_TOPICS = List.of(
            "Arquitectura Limpia y Modular Monolith en Sistemas Empresariales",
            "Optimización de Consultas SQL y Particionamiento en PostgreSQL",
            "Signals vs RxJS: Reactividad Atómica y Gestión de Estado en Frontend",
            "Virtual Threads en Java 21: Concurrencia Masiva y Rendimiento I/O con Spring Boot 3",
            "Seguridad en APIs: OAuth2, Rotación de JWTs y Mitigación OWASP"
    );

    private ContentSource deriveAutonomousSource(Tenant tenant) {
        String prompt = (tenant != null && tenant.getSystemPrompt() != null) ? tenant.getSystemPrompt().toLowerCase() : "";

        if (prompt.contains("ingenier") && (prompt.contains("civil") || prompt.contains("construcc") || prompt.contains("obra") || prompt.contains("estructur"))) {
            int idx = (int) (System.currentTimeMillis() / 86400000L % PIPELINE_CIVIL_TOPICS.size());
            String title = PIPELINE_CIVIL_TOPICS.get(idx);
            return new ContentSource(SourceMode.RESEARCH, title, "Análisis técnico y buenas prácticas en " + title, null, "https://linkedin.com");
        }

        if (prompt.contains("spring") || prompt.contains("angular") || prompt.contains("software") || prompt.contains("desarrollador") || prompt.contains("backend") || prompt.contains("frontend")) {
            int idx = (int) (System.currentTimeMillis() / 86400000L % PIPELINE_SOFTWARE_TOPICS.size());
            String title = PIPELINE_SOFTWARE_TOPICS.get(idx);
            return new ContentSource(SourceMode.RESEARCH, title, "Buenas prácticas y lecciones técnicas en " + title, null, "https://github.com");
        }

        if (!prompt.isBlank()) {
            String shortSubject = prompt.length() > 60 ? prompt.substring(0, 60).trim() + "..." : prompt;
            return new ContentSource(SourceMode.RESEARCH, "Innovación Profesional: " + shortSubject, "Reflexión técnica y estratégica basada en el perfil configurado", null, "https://linkedin.com");
        }

        return new ContentSource(SourceMode.RESEARCH, "Buenas Prácticas Profesionales y Gestión de Proyectos", "Criterios técnicos y lecciones prácticas de aplicación en el sector", null, "https://linkedin.com");
    }

    public ContentSource previewPipelineSource(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new PipelineExecutionException("Tenant not found with ID: " + tenantId));

        return gitHubSourceService.findRecentActivity(tenant)
                .or(() -> backupTopicService.previewNextTopic(tenant))
                .or(() -> researchSourceService.findTrendingTopic(tenant))
                .orElse(null);
    }
}
