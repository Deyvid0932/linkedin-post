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

    @Transactional
    public void executePipelineForTenant(UUID tenantId) {
        long startTime = System.currentTimeMillis();
        log.info("Iniciando Pipeline de Publicación para Tenant ID: {}", tenantId);

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new PipelineExecutionException("Tenant not found with ID: " + tenantId));

        if (!tenant.getIsActive()) {
            log.warn("Tenant {} está inactivo. Pipeline abortado.", tenantId);
            return;
        }

        if (Boolean.TRUE.equals(tenant.getIsEmergencyPaused())) {
            log.warn("Tenant {} está en PAUSA DE EMERGENCIA. Pipeline abortado para evitar publicaciones.", tenantId);
            return;
        }

        ContentSource source = null;
        String postText = null;
        ImageGeneratorService.ImageData imageData = null;

        // ========================================================
        // PRIORIDAD 0: COLA DE POSTS APROBADOS (FIFO)
        // ========================================================
        var draftOpt = draftPreviewRepository.findFirstByTenantIdOrderByCreatedAtAsc(tenantId);
        com.deyvid.backend.entity.DraftPreview draftToConsume = null;
        if (draftOpt.isPresent() && draftOpt.get().getGeneratedText() != null && !draftOpt.get().getGeneratedText().isBlank()) {
            draftToConsume = draftOpt.get();
            postText = draftToConsume.getGeneratedText();
            String imgUrl = draftToConsume.getImageUrl();
            byte[] bytes = (imgUrl != null && !imgUrl.isBlank()) ? imageGeneratorService.fetchBytesFromUrl(imgUrl) : null;
            imageData = new ImageGeneratorService.ImageData(bytes, imgUrl);
            source = new ContentSource(
                    draftToConsume.getSourceMode() != null ? draftToConsume.getSourceMode() : SourceMode.PROJECT,
                    "Post Aprobado por el Usuario en Estudio",
                    postText,
                    null,
                    draftToConsume.getSourceReference()
            );
            log.info("Pipeline seleccionó Prioridad 0 (Post de la cola FIFO, ID: {})", draftToConsume.getId());
        }

        // ==========================================
        // PRIORIDAD 1: MODO PROYECTO (GitHub Commits)
        // ==========================================
        if (source == null) {
            Optional<ContentSource> ghSource = gitHubSourceService.findRecentActivity(tenant);
            if (ghSource.isPresent()) {
                source = ghSource.get();
                log.info("Pipeline seleccionó Prioridad 1 (MODO PROYECTO vía GitHub)");
            }
        }

        // ========================================================
        // PRIORIDAD 2: BANCO DE IDEAS & TENDENCIAS (Unificado)
        // ========================================================
        if (source == null) {
            Optional<ContentSource> bankSource = backupTopicService.getNextTopic(tenant);
            if (bankSource.isPresent()) {
                source = bankSource.get();
                log.info("Pipeline seleccionó Prioridad 2 (BANCO UNIFICADO: {})", source.mode());
            }
        }

        // Fallback de rescate si el banco está vacío pero hay keywords de investigación anteriores
        if (source == null) {
            Optional<ContentSource> researchSource = researchSourceService.findTrendingTopic(tenant);
            if (researchSource.isPresent()) {
                source = researchSource.get();
                log.info("Pipeline recurrió a fallback de palabras clave");
            }
        }

        // ========================================================
        // PRIORIDAD 3: GENERACIÓN AUTÓNOMA BASADA EN SYSTEM PROMPT
        // ========================================================
        if (source == null) {
            source = deriveAutonomousSource(tenant);
            log.info("Pipeline activó Prioridad 3 (GENERACIÓN AUTÓNOMA adaptada al System Prompt): '{}'", source.title());
        }

        // Generar texto e imagen si no provenía de Prioridad 0
        if (postText == null) {
            postText = contentGeneratorService.generatePostContent(tenant, source);
            imageData = imageGeneratorService.generateOrFetchImage(source, postText);
        }

        // Obtener todas las cuentas habilitadas del tenant
        List<LinkedInCredential> targetAccounts = linkedInCredentialRepository.findByTenantIdAndIsEnabledTrue(tenantId);
        if (targetAccounts.isEmpty()) {
            linkedInCredentialRepository.findByTenantId(tenantId).ifPresent(targetAccounts::add);
        }

        if (targetAccounts.isEmpty()) {
            String err = "No hay ninguna cuenta de LinkedIn conectada o habilitada (isEnabled=true) para publicar en el Tenant " + tenantId;
            log.error("❌ [PIPELINE ALERTA] Falló publicación para tenant {}: {}", tenantId, err);
            publicationLogService.createLog(
                    tenant,
                    source.mode(),
                    PublicationStatus.FAILED,
                    postText,
                    imageData != null ? imageData.imageUrl() : null,
                    null,
                    source.referenceUrl(),
                    err,
                    System.currentTimeMillis() - startTime,
                    "deepseek-chat", 0
            );
            notificationService.createNotification(tenant, "ERROR", "Fallo de Publicación en LinkedIn", err);
            return;
        }

        log.info("📋 [PIPELINE CUENTAS] Se encontraron {} cuenta(s) objetivo para el Tenant: {}", targetAccounts.size(), tenantId);

        boolean isDryRun = Boolean.TRUE.equals(tenant.getIsDryRun());
        java.time.LocalDateTime startOfDay = java.time.LocalDate.now().atStartOfDay();
        String textHash = com.deyvid.backend.service.PublicationLogService.computeTextHash(postText);
        java.time.LocalDateTime fiveMinutesAgo = java.time.LocalDateTime.now().minusMinutes(5);

        boolean atLeastOneSuccess = false;

        // Publicar en cada cuenta habilitada de forma aislada
        for (LinkedInCredential accountRef : targetAccounts) {

            // 1. Bloqueo pesimista sobre la credencial para serializar ejecuciones simultáneas
            LinkedInCredential account = linkedInCredentialRepository.findByIdForUpdate(accountRef.getId())
                    .orElse(accountRef);

            String accountLabel = (account.getDisplayName() != null ? account.getDisplayName() : account.getEffectiveAuthorUrn()) +
                    " (" + account.getAccountType() + ")";

            // 2. Control de límite diario independiente por cuenta
            int maxDaily = account.getMaxPostsPerDay() != null ? account.getMaxPostsPerDay() : 1;
            long todayCount = publicationLogRepository.countByTenantIdAndStatusAndAuthorUrnAndCreatedAtGreaterThanEqual(
                    tenantId, PublicationStatus.SUCCESS, account.getEffectiveAuthorUrn(), startOfDay);

            log.info("🔍 [PIPELINE LÍMITE] Verificando cuenta: {} | Publicaciones hoy: {} / Límite diario: {} | Modo: {}",
                    accountLabel, todayCount, maxDaily, isDryRun ? "DRY-RUN" : "EN VIVO");

            if (todayCount >= maxDaily) {
                log.warn("⚠️ [PIPELINE LÍMITE ALCANZADO] Cuenta {} ya alcanzó su límite diario ({}/{} hoy). Omitiendo publicación.",
                        accountLabel, todayCount, maxDaily);
                continue;
            }

            // 3. Verificación de idempotencia (dedup en ventana de 5 min para evitar dobles envíos accidentales)
            boolean alreadyPublished = publicationLogRepository.existsByTenantIdAndStatusAndTextHashAndCreatedAtAfter(
                    tenantId, PublicationStatus.SUCCESS, textHash, fiveMinutesAgo);
            if (alreadyPublished) {
                log.info("ℹ️ [PIPELINE DEDUP] Post duplicado detectado para cuenta {} (ya publicado en los últimos 5 min). Omitiendo.", accountLabel);
                continue;
            }

            try {
                String linkedinUrn;
                byte[] imageBytes = imageData != null ? imageData.bytes() : null;
                String finalImageUrl = imageData != null ? imageData.imageUrl() : null;

                if (isDryRun) {
                    log.info("🧪 [PIPELINE DRY-RUN] Modo Simulación activo para cuenta {}. Generando URN de prueba.", accountLabel);
                    linkedinUrn = "urn:li:share:dryrun-" + System.currentTimeMillis();
                } else {
                    linkedinUrn = linkedInPublisherService.publishSingleAccount(tenant, account, postText, imageBytes);
                }

                long duration = Math.max(1L, System.currentTimeMillis() - startTime);
                log.info("✅ [PIPELINE ÉXITO] Post publicado en {} (URN: {}) en {} ms | Zero-Touch OK", accountLabel, linkedinUrn, duration);
                atLeastOneSuccess = true;

                publicationLogService.createLog(
                        tenant,
                        source.mode(),
                        PublicationStatus.SUCCESS,
                        account.getAccountType(),
                        account.getEffectiveAuthorUrn(),
                        isDryRun ? "[SIMULACIÓN / DRY-RUN]\n" + postText : postText,
                        finalImageUrl,
                        linkedinUrn,
                        source.referenceUrl(),
                        null,
                        duration,
                        "deepseek-chat",
                        500
                );
            } catch (Exception e) {
                long duration = Math.max(1L, System.currentTimeMillis() - startTime);
                log.error("❌ [PIPELINE ERROR] Error publicando en cuenta {} para tenant {}: {}", accountLabel, tenantId, e.getMessage(), e);

                publicationLogService.createLog(
                        tenant,
                        source.mode(),
                        PublicationStatus.FAILED,
                        account.getAccountType(),
                        account.getEffectiveAuthorUrn(),
                        postText,
                        imageData != null ? imageData.imageUrl() : null,
                        null,
                        source.referenceUrl(),
                        "Fallo en cuenta " + accountLabel + ": " + e.getMessage(),
                        duration,
                        "deepseek-chat", 0
                );

                notificationService.createNotification(tenant, "ERROR", "Fallo al publicar en " + accountLabel,
                        "No se pudo completar la publicación en " + accountLabel + ": " + e.getMessage());
            }
        }

        // Si el post provino de la cola programada (Prioridad 0) y se publicó exitosamente, lo removemos de la cola
        if (draftToConsume != null && atLeastOneSuccess) {
            draftPreviewRepository.delete(draftToConsume);
            log.info("Post programado ID {} retirado de la cola tras publicación exitosa.", draftToConsume.getId());
        }
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
