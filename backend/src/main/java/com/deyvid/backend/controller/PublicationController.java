package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.FeedbackRequest;
import com.deyvid.backend.dto.request.TokenEstimateRequest;
import com.deyvid.backend.dto.request.UpdateDraftRequest;
import com.deyvid.backend.dto.response.GeneratedPreviewResponse;
import com.deyvid.backend.dto.response.PublicationLogResponse;
import com.deyvid.backend.dto.response.SwipeBatchResponse;
import com.deyvid.backend.dto.response.TokenEstimateResponse;
import com.deyvid.backend.entity.FeedbackIa;
import com.deyvid.backend.entity.PublicationLog;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.repository.DraftPreviewRepository;
import com.deyvid.backend.repository.FeedbackIaRepository;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.repository.TenantRepository;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.DraftPreviewService;
import com.deyvid.backend.service.PublicationLogService;
import com.deyvid.backend.service.ai.ContentGeneratorService;
import com.deyvid.backend.service.ai.ImageGeneratorService;
import com.deyvid.backend.service.ai.VectorStoreService;
import com.deyvid.backend.service.linkedin.ContentSource;
import com.deyvid.backend.service.linkedin.LinkedInPublisherService;
import com.deyvid.backend.service.pipeline.ContentPipelineService;
import com.deyvid.backend.service.source.BackupTopicService;
import com.deyvid.backend.service.source.GitHubSourceService;
import com.deyvid.backend.service.cache.GenerationCacheService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import com.deyvid.backend.entity.LinkedInCredential;
import com.deyvid.backend.entity.Tenant;

@RestController
@RequestMapping("/api/v1/publications")
@RequiredArgsConstructor
@Slf4j
public class PublicationController {

    private final AuthHelper authHelper;
    private final TenantRepository tenantRepository;
    private final PublicationLogService publicationLogService;
    private final PublicationLogRepository publicationLogRepository;
    private final ContentPipelineService contentPipelineService;
    private final DraftPreviewService draftPreviewService;
    private final ContentGeneratorService contentGeneratorService;
    private final ImageGeneratorService imageGeneratorService;
    private final LinkedInPublisherService linkedInPublisherService;
    private final LinkedInCredentialRepository linkedInCredentialRepository;
    private final FeedbackIaRepository feedbackIaRepository;
    private final DraftPreviewRepository draftPreviewRepository;
    private final VectorStoreService vectorStoreService;
    private final AuditLogService auditLogService;
    private final GitHubSourceService gitHubSourceService;
    private final BackupTopicService backupTopicService;
    private final GenerationCacheService generationCacheService;

    @GetMapping
    public ResponseEntity<Page<PublicationLogResponse>> getHistory(
            Authentication auth,
            @RequestParam(required = false) PublicationStatus status,
            @RequestParam(required = false) SourceMode sourceMode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size) {
            User user = authHelper.getCurrentUser(auth);
            Page<PublicationLog> logs = publicationLogService.getLogsByTenant(
                    user.getTenant().getId(), status, sourceMode, startDate, endDate, search, PageRequest.of(page, size));

            Page<PublicationLogResponse> response = logs.map(this::mapToResponse);
            return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PublicationLogResponse> getPublicationById(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        PublicationLog plog = publicationLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Registro de publicación no encontrado"));

        if (!plog.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        return ResponseEntity.ok(mapToResponse(plog));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePublicationById(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        PublicationLog plog = publicationLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Registro de publicación no encontrado"));

        if (!plog.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        publicationLogRepository.delete(plog);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "DELETE_PUBLICATION_LOG", "Registro de publicación ID " + id + " eliminado");
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/history/clear")
    @Transactional
    public ResponseEntity<Map<String, Object>> clearHistory(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        publicationLogRepository.deleteByTenantId(user.getTenant().getId());
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "CLEAR_PUBLICATION_HISTORY", "Historial de publicaciones vaciado por completo");
        return ResponseEntity.ok(Map.of("message", "Historial de publicaciones eliminado correctamente"));
    }

    @PostMapping("/estimate-tokens")
    public ResponseEntity<TokenEstimateResponse> estimateTokens(Authentication auth, @RequestBody TokenEstimateRequest req) {
        int promptLen = (req != null && req.prompt() != null) ? req.prompt().length() : 300;
        int topicLen = (req != null && req.topic() != null) ? req.topic().length() : 100;
        int batches = (req != null && req.batchCount() != null && req.batchCount() > 0) ? req.batchCount() : 3;

        int estimatedPromptTokens = (int) Math.ceil((promptLen + topicLen + 200) / 3.5);
        int estimatedCompletionTokens = 450 * batches;
        int totalTokens = (estimatedPromptTokens * batches) + estimatedCompletionTokens;
        double costUsd = (totalTokens / 1000.0) * 0.0014;

        return ResponseEntity.ok(new TokenEstimateResponse(
                estimatedPromptTokens,
                estimatedCompletionTokens,
                totalTokens,
                costUsd,
                98500,
                "deepseek-chat"
        ));
    }

    @GetMapping("/sample-preview")
    public ResponseEntity<Map<String, Object>> getSamplePreview(Authentication auth) {
        return ResponseEntity.ok(Map.of(
                "title", "Ejemplo: Arquitectura Reactiva en Java con Virtual Threads",
                "sampleText", """
                        ¿Sigues bloqueando hilos tradicionales en Java o ya diste el salto a Virtual Threads?
                        
                        Durante años, optimizar APIs de alto tráfico significaba lidiar con pools complejos de Netty o programación reactiva difícil de depurar.
                        
                        3 Claves que cambiaron nuestra forma de construir backends:
                        • Menor huella de memoria: millones de hilos virtuales consumen una fracción de RAM.
                        • Código síncrono y legible con rendimiento no bloqueante.
                        • Trazabilidad nativa en depuración sin perder el contexto de ejecución.
                        
                        ¿Ya estás aprovechando Project Loom en producción o sigues evaluándolo?
                        """,
                "imageUrl", "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80",
                "mode", "PROJECT",
                "source", "Actualización en core-engine / Feature Loom"
        ));
    }

    private final java.util.concurrent.atomic.AtomicInteger batchCounter = new java.util.concurrent.atomic.AtomicInteger(0);

    private static final List<String> CIVIL_ENGINEERING_TOPICS = List.of(
            "Control de Calidad y Resistencia de Materiales en Estructuras de Concreto",
            "Gestión y Planificación de Obras Civiles: Mitigación de Sobrecostos y Tiempos",
            "Seguridad Estructural y Normativa Técnica en Edificaciones Modernas",
            "BIM y Supervisión Técnica Digitalizada en Proyectos de Construcción",
            "Tecnología de Concretos Especiales y Pruebas de Carga en Campo",
            "Gestión de Residuos de Construcción y Prácticas Sostenibles en Obra",
            "Mantenimiento Preventivo e Inspección de Infraestructura Civil",
            "Supervisión Geotécnica y Cimentaciones en Suelos Complejos"
    );

    private static final List<String> SOFTWARE_DEV_TOPICS = List.of(
            "Signals vs RxJS: Reactividad Atómica y Gestión de Estado en Frontend",
            "Virtual Threads en Java 21: Concurrencia Masiva y Rendimiento I/O con Spring Boot 3",
            "Optimización de Consultas SQL y Particionamiento en PostgreSQL",
            "Arquitectura Limpia y Modular Monolith en Sistemas Empresariales",
            "Seguridad en APIs: OAuth2, Rotación de JWTs y Mitigación de Vulnerabilidades OWASP",
            "Caché Distribuido con Redis: Patrones Cache-Aside, Write-Through y Resiliencia",
            "Testing Moderno en Backend: De Tests Unitarios con JUnit 5 a Testcontainers",
            "De Microservicios a Modular Monolith: Por qué la Simplicidad Gana en Producción",
            "Observabilidad en Producción: OpenTelemetry, Tracing Distribuido y Métricas",
            "Event-Driven Architecture con Apache Kafka: CQRS y Consistencia Eventual"
    );

    private ContentSource deriveSourceFromTenantPersona(Tenant tenant, String customTopic) {
        if (customTopic != null && !customTopic.isBlank()) {
            return new ContentSource(
                    SourceMode.RESEARCH,
                    customTopic.trim(),
                    "Análisis y reflexión profesional sobre la temática: " + customTopic.trim(),
                    null,
                    "https://linkedin.com"
            );
        }

        String prompt = (tenant != null && tenant.getSystemPrompt() != null) ? tenant.getSystemPrompt().toLowerCase() : "";

        if (prompt.contains("ingenier") && (prompt.contains("civil") || prompt.contains("construcc") || prompt.contains("obra") || prompt.contains("estructur"))) {
            int idx = Math.abs(batchCounter.getAndIncrement()) % CIVIL_ENGINEERING_TOPICS.size();
            String title = CIVIL_ENGINEERING_TOPICS.get(idx);
            return new ContentSource(
                    SourceMode.RESEARCH,
                    title,
                    "Análisis técnico, control de obra y mejores prácticas en " + title,
                    null,
                    "https://linkedin.com"
            );
        }

        if (prompt.contains("spring") || prompt.contains("angular") || prompt.contains("software") || prompt.contains("desarrollador") || prompt.contains("backend") || prompt.contains("frontend") || prompt.contains("fullstack")) {
            int idx = Math.abs(batchCounter.getAndIncrement()) % SOFTWARE_DEV_TOPICS.size();
            String title = SOFTWARE_DEV_TOPICS.get(idx);
            return new ContentSource(
                    SourceMode.RESEARCH,
                    title,
                    "Buenas prácticas de desarrollo, arquitectura y aplicación práctica en " + title,
                    null,
                    "https://github.com"
            );
        }

        if (!prompt.isBlank()) {
            String shortSubject = prompt.length() > 60 ? prompt.substring(0, 60).trim() + "..." : prompt;
            return new ContentSource(
                    SourceMode.RESEARCH,
                    "Innovación y Buenas Prácticas: " + shortSubject,
                    "Reflexión estratégica basada en la especialidad configurada: " + prompt,
                    null,
                    "https://linkedin.com"
            );
        }

        int idx = Math.abs(batchCounter.getAndIncrement()) % SOFTWARE_DEV_TOPICS.size();
        String title = SOFTWARE_DEV_TOPICS.get(idx);
        return new ContentSource(
                SourceMode.RESEARCH,
                title,
                "Análisis profesional y aplicación práctica sobre " + title,
                null,
                "https://linkedin.com"
        );
    }

    private ContentSource resolveContentSource(User user, String sourceType, String mode, String customTopic) {
        String effectiveSourceType = (sourceType != null && !sourceType.isBlank()) ? sourceType : mode;
        Tenant tenant = getUserTenant(user);

        // 1. Si se especificó un tema manual personalizado
        if (customTopic != null && !customTopic.isBlank()) {
            return deriveSourceFromTenantPersona(tenant, customTopic.trim());
        }

        // 2. MODO REPOSITORIO GITHUB
        if ("GITHUB".equalsIgnoreCase(effectiveSourceType) || "REPO".equalsIgnoreCase(effectiveSourceType) || "PROJECT".equalsIgnoreCase(effectiveSourceType)) {
            Optional<ContentSource> ghSource = gitHubSourceService.findRecentActivity(tenant != null ? tenant : user.getTenant());
            if (ghSource.isPresent()) {
                log.info("Generación en Modo GITHUB (Commits recientes): '{}'", ghSource.get().title());
                return ghSource.get();
            }
            log.info("Generación en Modo GITHUB: Repositorio activo del usuario.");
            return new ContentSource(
                    SourceMode.PROJECT,
                    "Arquitectura y Desarrollo de Proyectos Técnicos",
                    "Lecciones prácticas, modularidad y lecciones aprendidas en proyectos reales.",
                    null,
                    "https://github.com"
            );
        }

        // 3. MODO BANCO DE IDEAS / MODO PERSONALIDAD / AUTOMÁTICO:
        // Prioridad principal: Extraer el siguiente tema pendiente (no usado) del Banco de Ideas
        Optional<ContentSource> bankSource = backupTopicService.previewNextTopic(tenant != null ? tenant : user.getTenant());
        if (bankSource.isPresent()) {
            log.info("Generación en Estudio usando tema del BANCO DE IDEAS: '{}'", bankSource.get().title());
            return bankSource.get();
        }

        // 4. Fallback si el Banco de Ideas está vacío
        log.info("Banco de ideas sin temas disponibles. Recurriendo a tema contextual de la especialidad.");
        return deriveSourceFromTenantPersona(tenant, null);
    }

    private Tenant getUserTenant(User user) {
        if (user == null || user.getTenant() == null) return null;
        return tenantRepository.findById(user.getTenant().getId()).orElse(user.getTenant());
    }

    @GetMapping("/swipe-batch")
    public ResponseEntity<SwipeBatchResponse> generateSwipeBatch(
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String customTopic,
            @RequestParam(defaultValue = "true") boolean lazy,
            @RequestParam(defaultValue = "DETAILED") String postLength,
            Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        Tenant tenant = getUserTenant(user);
        ContentSource source = resolveContentSource(user, sourceType, mode, customTopic);

        long startAll = System.currentTimeMillis();

        if (lazy) {
            // Optimización de tokens: Generar únicamente Variante A de inmediato
            long startA = System.currentTimeMillis();
            String versionAText = contentGeneratorService.generateVersionWithApproach(tenant, source, "COMPARATIVE_B2B", postLength);
            long durA = Math.max(1L, System.currentTimeMillis() - startA);

            ImageGeneratorService.ImageData imgData = imageGeneratorService.generateOrFetchImage(source, versionAText);
            String batchImageUrl = imgData != null ? imgData.imageUrl() : null;

            SwipeBatchResponse.SwipeVersionDto vA = new SwipeBatchResponse.SwipeVersionDto(
                    UUID.randomUUID().toString(), "COMPARATIVE_B2B", "1. Consultoría B2B (Comparativa VS)",
                    versionAText, batchImageUrl, Math.max(200, versionAText.length() / 4), 0.0009, (double) durA
            );

            if (tenant != null && tenant.getId() != null) {
                String cacheKeyA = GenerationCacheService.buildKey(
                        tenant.getId(),
                        source.mode().name(),
                        source.title(),
                        "COMPARATIVE_B2B",
                        postLength
                );
                generationCacheService.put(cacheKeyA, vA);
            }

            // Versiones B y C disponibles para generar bajo demanda (0 tokens gastados inicialmente)
            SwipeBatchResponse.SwipeVersionDto vB = new SwipeBatchResponse.SwipeVersionDto(
                    UUID.randomUUID().toString(), "STORYTELLER", "2. Storytelling / Aprendizaje",
                    null, batchImageUrl, 0, 0.0, 0.0
            );
            SwipeBatchResponse.SwipeVersionDto vC = new SwipeBatchResponse.SwipeVersionDto(
                    UUID.randomUUID().toString(), "PROVOCATIVE", "3. Pregunta & Debate Comunitario",
                    null, batchImageUrl, 0, 0.0, 0.0
            );

            return ResponseEntity.ok(new SwipeBatchResponse(
                    source.mode().name(),
                    source.title(),
                    source.referenceUrl(),
                    List.of(vA, vB, vC)
            ));
        }

        // Si lazy == false, generar las 3 variantes en paralelo
        CompletableFuture<String> futureA = CompletableFuture.supplyAsync(() ->
                contentGeneratorService.generateVersionWithApproach(tenant, source, "COMPARATIVE_B2B", postLength));

        CompletableFuture<String> futureB = CompletableFuture.supplyAsync(() ->
                contentGeneratorService.generateVersionWithApproach(tenant, source, "STORYTELLER", postLength));

        CompletableFuture<String> futureC = CompletableFuture.supplyAsync(() ->
                contentGeneratorService.generateVersionWithApproach(tenant, source, "PROVOCATIVE", postLength));

        CompletableFuture<ImageGeneratorService.ImageData> futureImg = CompletableFuture.supplyAsync(() ->
                imageGeneratorService.generateOrFetchImage(source, source.title()));

        String versionAText = futureA.join();
        String versionBText = futureB.join();
        String versionCText = futureC.join();
        ImageGeneratorService.ImageData imgData = futureImg.join();

        long totalDur = Math.max(1L, System.currentTimeMillis() - startAll);
        double singleDur = (double) totalDur / 3.0;
        String batchImageUrl = imgData != null ? imgData.imageUrl() : null;

        SwipeBatchResponse.SwipeVersionDto vA = new SwipeBatchResponse.SwipeVersionDto(
                UUID.randomUUID().toString(), "COMPARATIVE_B2B", "1. Consultoría B2B (Comparativa VS)",
                versionAText, batchImageUrl, Math.max(200, versionAText.length() / 4), 0.0009, singleDur
        );
        SwipeBatchResponse.SwipeVersionDto vB = new SwipeBatchResponse.SwipeVersionDto(
                UUID.randomUUID().toString(), "STORYTELLER", "2. Storytelling / Aprendizaje",
                versionBText, batchImageUrl, Math.max(200, versionBText.length() / 4), 0.0009, singleDur
        );
        SwipeBatchResponse.SwipeVersionDto vC = new SwipeBatchResponse.SwipeVersionDto(
                UUID.randomUUID().toString(), "PROVOCATIVE", "3. Pregunta & Debate Comunitario",
                versionCText, batchImageUrl, Math.max(200, versionCText.length() / 4), 0.0009, singleDur
        );

        if (tenant != null && tenant.getId() != null) {
            generationCacheService.put(GenerationCacheService.buildKey(tenant.getId(), source.mode().name(), source.title(), "COMPARATIVE_B2B", postLength), vA);
            generationCacheService.put(GenerationCacheService.buildKey(tenant.getId(), source.mode().name(), source.title(), "STORYTELLER", postLength), vB);
            generationCacheService.put(GenerationCacheService.buildKey(tenant.getId(), source.mode().name(), source.title(), "PROVOCATIVE", postLength), vC);
        }

        return ResponseEntity.ok(new SwipeBatchResponse(
                source.mode().name(),
                source.title(),
                source.referenceUrl(),
                List.of(vA, vB, vC)
        ));
    }

    @GetMapping({"/single-version", "/swipe-version"})
    public ResponseEntity<SwipeBatchResponse.SwipeVersionDto> generateSingleVersion(
            @RequestParam(defaultValue = "COMPARATIVE_B2B") String approach,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String customTopic,
            @RequestParam(defaultValue = "DETAILED") String postLength,
            Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        Tenant tenant = getUserTenant(user);
        ContentSource source = resolveContentSource(user, sourceType, mode, customTopic);

        String cacheKey = null;
        if (tenant != null && tenant.getId() != null) {
            cacheKey = GenerationCacheService.buildKey(
                    tenant.getId(),
                    source.mode().name(),
                    source.title(),
                    approach,
                    postLength
            );
            Optional<SwipeBatchResponse.SwipeVersionDto> cached = generationCacheService.get(cacheKey);
            if (cached.isPresent()) {
                log.info("Variante {} [{}] recuperada de caché en memoria para tenant {} (0 tokens gastados, 0ms)",
                        approach, postLength, tenant.getId());
                return ResponseEntity.ok(cached.get());
            }
        }

        long start = System.currentTimeMillis();
        String text = contentGeneratorService.generateVersionWithApproach(tenant, source, approach, postLength);
        long dur = Math.max(1L, System.currentTimeMillis() - start);

        String structureTitle = switch (approach) {
            case "STORYTELLER" -> "2. Storytelling / Aprendizaje";
            case "PROVOCATIVE" -> "3. Pregunta & Debate Comunitario";
            default -> "1. Consultoría B2B (Comparativa VS)";
        };

        ImageGeneratorService.ImageData imgData = imageGeneratorService.generateOrFetchImage(source, text);
        String imageUrl = imgData != null ? imgData.imageUrl() : null;

        SwipeBatchResponse.SwipeVersionDto resultDto = new SwipeBatchResponse.SwipeVersionDto(
                UUID.randomUUID().toString(), approach, structureTitle,
                text, imageUrl, Math.max(200, text.length() / 4), 0.0009, (double) dur
        );

        if (cacheKey != null) {
            generationCacheService.put(cacheKey, resultDto);
        }

        return ResponseEntity.ok(resultDto);
    }

    private record ApproachConfig(int index, String approach, String title) {}

    @GetMapping(value = "/swipe-batch/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public reactor.core.publisher.Flux<org.springframework.http.codec.ServerSentEvent<String>> streamSwipeBatch(
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String customTopic,
            @RequestParam(defaultValue = "MICRO") String postLength,
            Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        Tenant tenant = getUserTenant(user);
        ContentSource source = resolveContentSource(user, sourceType, mode, customTopic);

        org.springframework.http.codec.ServerSentEvent<String> initEvent = org.springframework.http.codec.ServerSentEvent.<String>builder()
                .event("init")
                .data(String.format("{\"sourceMode\":\"%s\",\"topicTitle\":\"%s\",\"referenceUrl\":\"%s\"}",
                        source.mode().name(),
                        escapeJson(source.title()),
                        escapeJson(source.referenceUrl())))
                .build();

        List<ApproachConfig> approaches = List.of(
                new ApproachConfig(0, "COMPARATIVE_B2B", "1. Consultoría B2B (Comparativa VS)"),
                new ApproachConfig(1, "STORYTELLER", "2. Storytelling / Aprendizaje"),
                new ApproachConfig(2, "PROVOCATIVE", "3. Pregunta & Debate Comunitario")
        );

        reactor.core.publisher.Flux<org.springframework.http.codec.ServerSentEvent<String>> versionStreams = reactor.core.publisher.Flux.concat(
                approaches.stream().map(appr -> {
                    org.springframework.http.codec.ServerSentEvent<String> startEvent = org.springframework.http.codec.ServerSentEvent.<String>builder()
                            .event("version_start")
                            .data(String.format("{\"index\":%d,\"approach\":\"%s\",\"tituloEstructura\":\"%s\"}",
                                    appr.index(), appr.approach(), escapeJson(appr.title())))
                            .build();

                    reactor.core.publisher.Flux<org.springframework.http.codec.ServerSentEvent<String>> tokenFlux = contentGeneratorService
                            .streamVersionWithApproach(tenant, source, appr.approach(), postLength)
                            .map(delta -> org.springframework.http.codec.ServerSentEvent.<String>builder()
                                    .event("token")
                                    .data(String.format("{\"index\":%d,\"delta\":\"%s\"}", appr.index(), escapeJson(delta)))
                                    .build());

                    org.springframework.http.codec.ServerSentEvent<String> endEvent = org.springframework.http.codec.ServerSentEvent.<String>builder()
                            .event("version_end")
                            .data(String.format("{\"index\":%d,\"approach\":\"%s\"}", appr.index(), appr.approach()))
                            .build();

                    return reactor.core.publisher.Flux.concat(
                            reactor.core.publisher.Flux.just(startEvent),
                            tokenFlux,
                            reactor.core.publisher.Flux.just(endEvent)
                    );
                }).toList()
        );

        org.springframework.http.codec.ServerSentEvent<String> completeEvent = org.springframework.http.codec.ServerSentEvent.<String>builder()
                .event("complete")
                .data("{\"status\":\"success\"}")
                .build();

        return reactor.core.publisher.Flux.concat(
                reactor.core.publisher.Flux.just(initEvent),
                versionStreams,
                reactor.core.publisher.Flux.just(completeEvent)
        );
    }

    @GetMapping(value = "/preview/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public reactor.core.publisher.Flux<org.springframework.http.codec.ServerSentEvent<String>> streamPreview(
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String customTopic,
            @RequestParam(defaultValue = "MICRO") String postLength,
            Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        Tenant tenant = getUserTenant(user);
        ContentSource source = resolveContentSource(user, sourceType, mode, customTopic);
        if (source == null) {
            source = deriveSourceFromTenantPersona(tenant, customTopic);
        }

        final ContentSource finalSource = source;

        org.springframework.http.codec.ServerSentEvent<String> initEvent = org.springframework.http.codec.ServerSentEvent.<String>builder()
                .event("init")
                .data(String.format("{\"sourceMode\":\"%s\",\"topicTitle\":\"%s\"}",
                        finalSource.mode().name(), escapeJson(finalSource.title())))
                .build();

        StringBuilder fullTextBuilder = new StringBuilder();

        reactor.core.publisher.Flux<org.springframework.http.codec.ServerSentEvent<String>> tokenFlux = contentGeneratorService
                .streamVersionWithApproach(tenant, finalSource, "COMPARATIVE_B2B", postLength)
                .map(delta -> {
                    fullTextBuilder.append(delta);
                    return org.springframework.http.codec.ServerSentEvent.<String>builder()
                            .event("token")
                            .data(String.format("{\"delta\":\"%s\"}", escapeJson(delta)))
                            .build();
                });

        return reactor.core.publisher.Flux.concat(
                reactor.core.publisher.Flux.just(initEvent),
                tokenFlux
        ).concatWith(reactor.core.publisher.Mono.fromSupplier(() -> {
            String fullText = fullTextBuilder.toString();
            ImageGeneratorService.ImageData imageData = imageGeneratorService.generateOrFetchImage(finalSource, fullText);
            
            // Persistir borrador
            draftPreviewService.updateDraft(user.getTenant().getId(), fullText, imageData.imageUrl());

            return org.springframework.http.codec.ServerSentEvent.<String>builder()
                    .event("complete")
                    .data(String.format("{\"sourceMode\":\"%s\",\"generatedText\":\"%s\",\"imageUrl\":\"%s\",\"sourceReference\":\"%s\"}",
                            finalSource.mode().name(),
                            escapeJson(fullText),
                            escapeJson(imageData.imageUrl()),
                            escapeJson(finalSource.referenceUrl())))
                    .build();
        }));
    }

    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\b", "\\b")
                  .replace("\f", "\\f")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }

    @GetMapping("/search-image")
    public ResponseEntity<Map<String, String>> searchImage(@RequestParam(defaultValue = "data analytics dashboard") String query) {
        ImageGeneratorService.ImageData img = imageGeneratorService.generateOrFetchImage(
                new ContentSource(SourceMode.RESEARCH, query, query, null, null), query
        );
        return ResponseEntity.ok(Map.of("imageUrl", img.imageUrl()));
    }

    @PostMapping("/feedback")
    @Transactional
    public ResponseEntity<Map<String, Object>> saveFeedback(Authentication auth, @Valid @RequestBody FeedbackRequest req) {
        User user = authHelper.getCurrentUser(auth);

        SourceMode parsedMode = SourceMode.PROJECT;
        if (req.sourceMode() != null) {
            String clean = req.sourceMode().toUpperCase();
            if (clean.contains("RESEARCH") || clean.contains("INVESTIGAC")) {
                parsedMode = SourceMode.RESEARCH;
            } else if (clean.contains("BACKUP") || clean.contains("BANCO")) {
                parsedMode = SourceMode.BACKUP;
            } else {
                parsedMode = SourceMode.PROJECT;
            }
        }

        FeedbackIa feedback = FeedbackIa.builder()
                .tenant(user.getTenant())
                .textoGenerado(req.textoGenerado())
                .tema(req.tema() != null ? req.tema() : "General")
                .puntajeUsuario(req.puntajeUsuario() != null ? req.puntajeUsuario() : 0)
                .estructuraUsada(req.estructuraUsada() != null ? req.estructuraUsada() : "DEFAULT")
                .sourceMode(parsedMode)
                .llmTokensUsed(req.tokensUsed() != null ? req.tokensUsed() : 500)
                .costUsd(req.costUsd() != null ? BigDecimal.valueOf(req.costUsd()) : BigDecimal.valueOf(0.0007))
                .build();

        FeedbackIa saved = feedbackIaRepository.save(feedback);

        // Guardar embedding en Vector Store (pgvector) de forma segura sin romper la petición
        try {
            vectorStoreService.saveFeedbackDocument(saved);
        } catch (Exception e) {
            log.warn("No se pudo persistir embedding vectorial para feedback ID {}: {}", saved.getId(), e.getMessage());
        }

        // Si el usuario APROBÓ el post (+1), se encola en la cola programada (Prioridad 0) para despacharse en su horario Quartz:
        if (req.puntajeUsuario() != null && req.puntajeUsuario() == 1) {
            LinkedInCredential targetAccount = null;
            if (req.targetCredentialId() != null) {
                targetAccount = linkedInCredentialRepository.findById(req.targetCredentialId()).orElse(null);
            }
            if (targetAccount == null) {
                targetAccount = linkedInCredentialRepository.findByTenantId(user.getTenant().getId()).orElse(null);
            }

            String authorUrn = targetAccount != null ? targetAccount.getEffectiveAuthorUrn() : null;

            com.deyvid.backend.entity.DraftPreview draft = com.deyvid.backend.entity.DraftPreview.builder()
                    .tenant(user.getTenant())
                    .sourceMode(parsedMode)
                    .generatedText(req.textoGenerado())
                    .imageUrl(req.imageUrl())
                    .authorUrn(authorUrn)
                    .targetCredentialId(req.targetCredentialId())
                    .sourceReference(req.tema() != null ? req.tema() : "Post Aprobado en Estudio")
                    .build();

            draftPreviewRepository.save(draft);
            long queuedCount = draftPreviewRepository.countByTenantId(user.getTenant().getId());

            // Marcar el tema en el Banco de Ideas como investigado y registrar su fecha de uso (used_at)
            if (req.tema() != null && !req.tema().isBlank()) {
                try {
                    backupTopicService.markTopicAsUsed(user.getTenant(), req.tema());
                } catch (Exception e) {
                    log.warn("No se pudo marcar el tema como usado en Banco de Ideas: {}", e.getMessage());
                }
            }

            auditLogService.recordAction(user.getTenant(), user.getEmail(), "POST_QUEUED",
                    "Post aprobado y encolado. Total en cola: " + queuedCount);

            return ResponseEntity.ok(Map.of(
                    "message", "¡Post aprobado y programado exitosamente! Tienes " + queuedCount + " post(s) en cola esperando su horario de publicación.",
                    "id", saved.getId(),
                    "puntaje", saved.getPuntajeUsuario(),
                    "queued", true,
                    "queuedCount", queuedCount
            ));
        }

        // Si el usuario calificó o descartó el post, también se marca el tema como Investigado
        if (req.tema() != null && !req.tema().isBlank()) {
            try {
                backupTopicService.markTopicAsUsed(user.getTenant(), req.tema());
            } catch (Exception e) {
                log.warn("No se pudo marcar el tema como investigado en Banco de Ideas: {}", e.getMessage());
            }
        }

        auditLogService.recordAction(user.getTenant(), user.getEmail(), "FEEDBACK_SUBMITTED",
                "Evaluación registrada con puntaje: " + saved.getPuntajeUsuario() + " para modo: " + parsedMode);

        return ResponseEntity.ok(Map.of(
                "message", "Feedback registrado exitosamente",
                "id", saved.getId(),
                "puntaje", saved.getPuntajeUsuario()
        ));
    }

    @GetMapping("/queue-count")
    public ResponseEntity<Map<String, Object>> getQueueCount(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        long count = draftPreviewRepository.countByTenantId(user.getTenant().getId());
        return ResponseEntity.ok(Map.of("queueCount", count));
    }

    @GetMapping("/queue")
    public ResponseEntity<List<PublicationLogResponse>> getQueuedPosts(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        List<com.deyvid.backend.entity.DraftPreview> drafts = draftPreviewRepository.findAllByTenantIdOrderByCreatedAtAsc(user.getTenant().getId());
        List<PublicationLogResponse> response = drafts.stream().map(d -> new PublicationLogResponse(
                d.getId(),
                d.getSourceMode() != null ? d.getSourceMode() : SourceMode.PROJECT,
                PublicationStatus.PENDING,
                null,
                d.getAuthorUrn(),
                d.getGeneratedText(),
                d.getImageUrl(),
                null,
                d.getSourceReference() != null ? d.getSourceReference() : "Post Aprobado en Estudio",
                null,
                null,
                "deepseek-chat",
                500,
                null,
                d.getCreatedAt()
        )).toList();
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/queue/{id}")
    public ResponseEntity<Void> deleteQueuedPost(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        var draft = draftPreviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Post en cola no encontrado"));
        if (!draft.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }
        draftPreviewRepository.delete(draft);
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "DELETE_QUEUED_POST", "Post ID " + id + " retirado de la cola");
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/queue/{id}/publish-now")
    public ResponseEntity<Map<String, Object>> publishQueuedPostNow(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        var draft = draftPreviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Post en cola no encontrado"));
        if (!draft.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes");
        }

        List<LinkedInCredential> accounts = linkedInCredentialRepository.findByTenantIdAndIsEnabledTrue(user.getTenant().getId());
        if (accounts.isEmpty()) {
            linkedInCredentialRepository.findByTenantId(user.getTenant().getId()).ifPresent(accounts::add);
        }
        if (accounts.isEmpty()) {
            throw new IllegalArgumentException("No hay ninguna cuenta de LinkedIn conectada o habilitada para publicar");
        }

        LinkedInCredential targetAccount = accounts.stream()
                .filter(a -> draft.getTargetCredentialId() != null && draft.getTargetCredentialId().equals(a.getId()))
                .findFirst()
                .orElseGet(() -> accounts.stream()
                        .filter(a -> Boolean.TRUE.equals(a.getIsPrimary()))
                        .findFirst()
                        .orElse(accounts.get(0)));

        byte[] imageBytes = null;
        if (draft.getImageUrl() != null && !draft.getImageUrl().isBlank()) {
            try {
                imageBytes = imageGeneratorService.fetchBytesFromUrl(draft.getImageUrl());
            } catch (Exception e) {
                log.warn("No se pudieron descargar los bytes de la imagen del borrador: {}", e.getMessage());
            }
        }

        long startTime = System.currentTimeMillis();
        try {
            String textToPublish = draft.getGeneratedText();
            if (textToPublish == null || textToPublish.isBlank()) {
                throw new IllegalArgumentException("El borrador no contiene texto para publicar");
            }

            String linkedinUrn = linkedInPublisherService.publishSingleAccount(
                    user.getTenant(), targetAccount, textToPublish, imageBytes);

            long duration = System.currentTimeMillis() - startTime;

            publicationLogService.createLog(
                    user.getTenant(),
                    draft.getSourceMode() != null ? draft.getSourceMode() : SourceMode.PROJECT,
                    PublicationStatus.SUCCESS,
                    targetAccount.getAccountType(),
                    targetAccount.getEffectiveAuthorUrn(),
                    textToPublish,
                    draft.getImageUrl(),
                    linkedinUrn,
                    draft.getSourceReference() != null ? draft.getSourceReference() : "Publicación Directa desde Cola",
                    null,
                    duration,
                    "deepseek-chat",
                    500
            );

            draftPreviewRepository.delete(draft);

            auditLogService.recordAction(user.getTenant(), user.getEmail(), "PUBLISH_QUEUED_NOW",
                    "Post de cola publicado inmediatamente en " + targetAccount.getDisplayName() + " (URN: " + linkedinUrn + ")");

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "¡Post publicado exitosamente en LinkedIn!",
                    "linkedinUrn", linkedinUrn
            ));
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Error al publicar post desde cola: {}", e.getMessage());

            publicationLogService.createLog(
                    user.getTenant(),
                    draft.getSourceMode() != null ? draft.getSourceMode() : SourceMode.PROJECT,
                    PublicationStatus.FAILED,
                    targetAccount.getAccountType(),
                    targetAccount.getEffectiveAuthorUrn(),
                    draft.getGeneratedText(),
                    draft.getImageUrl(),
                    null,
                    draft.getSourceReference() != null ? draft.getSourceReference() : "Publicación Directa desde Cola",
                    "Fallo al publicar en LinkedIn: " + e.getMessage(),
                    duration,
                    "deepseek-chat",
                    0
            );

            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "No se pudo publicar en LinkedIn: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/{id}/retry")
    public ResponseEntity<Map<String, Object>> retryPublication(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        PublicationLog plog = publicationLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Registro de publicación no encontrado con ID: " + id));

        if (!plog.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes sobre este registro");
        }

        LinkedInCredential targetAccount = null;
        if (plog.getAuthorUrn() != null && !plog.getAuthorUrn().isBlank()) {
            targetAccount = linkedInCredentialRepository.findByTenantIdAndAuthorUrn(user.getTenant().getId(), plog.getAuthorUrn()).orElse(null);
        }
        if (targetAccount == null) {
            targetAccount = linkedInCredentialRepository.findByTenantId(user.getTenant().getId())
                    .orElseThrow(() -> new IllegalArgumentException("No hay cuentas de LinkedIn activas para reintentar"));
        }

        try {
            String textToPublish = plog.getGeneratedText();
            if (textToPublish == null || textToPublish.isBlank()) {
                throw new IllegalArgumentException("El registro no contiene texto para publicar");
            }

            byte[] imageBytes = (plog.getImageUrl() != null && !plog.getImageUrl().isBlank())
                    ? imageGeneratorService.fetchBytesFromUrl(plog.getImageUrl())
                    : null;

            String linkedinUrn = linkedInPublisherService.publishSingleAccount(
                    user.getTenant(), targetAccount, textToPublish, imageBytes);

            plog.setStatus(PublicationStatus.SUCCESS);
            plog.setLinkedinPostUrn(linkedinUrn);
            plog.setErrorMessage(null);
            plog.setPublishedAt(java.time.LocalDateTime.now());
            plog.setAccountType(targetAccount.getAccountType());
            plog.setAuthorUrn(targetAccount.getEffectiveAuthorUrn());
            PublicationLog updated = publicationLogRepository.save(plog);

            auditLogService.recordAction(user.getTenant(), user.getEmail(), "RETRY_PUBLICATION_SUCCESS",
                    "Post reintentado y publicado exitosamente en " + targetAccount.getDisplayName() + " (URN: " + linkedinUrn + ")");

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "¡Post reintentado y publicado exitosamente en LinkedIn!",
                    "linkedinUrn", linkedinUrn,
                    "log", mapToResponse(updated)
            ));
        } catch (Exception e) {
            log.error("Error al reintentar publicación ID {}: {}", id, e.getMessage());
            plog.setErrorMessage("Fallo en reintento: " + e.getMessage());
            publicationLogRepository.save(plog);

            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "No se pudo completar el reintento: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/{id}/republish")
    public ResponseEntity<Map<String, Object>> republishPublication(Authentication auth, @PathVariable UUID id) {
        User user = authHelper.getCurrentUser(auth);
        PublicationLog plog = publicationLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Registro de publicación no encontrado con ID: " + id));

        if (!plog.getTenant().getId().equals(user.getTenant().getId())) {
            throw new IllegalArgumentException("Permisos insuficientes sobre este registro");
        }

        LinkedInCredential targetAccount = null;
        if (plog.getAuthorUrn() != null && !plog.getAuthorUrn().isBlank()) {
            targetAccount = linkedInCredentialRepository.findByTenantIdAndAuthorUrn(user.getTenant().getId(), plog.getAuthorUrn()).orElse(null);
        }
        if (targetAccount == null) {
            targetAccount = linkedInCredentialRepository.findByTenantId(user.getTenant().getId())
                    .orElseThrow(() -> new IllegalArgumentException("No hay cuentas de LinkedIn activas para republicar"));
        }

        long startTime = System.currentTimeMillis();
        try {
            String textToPublish = plog.getGeneratedText();
            if (textToPublish == null || textToPublish.isBlank()) {
                throw new IllegalArgumentException("El registro no contiene texto para republicar");
            }

            byte[] imageBytes = (plog.getImageUrl() != null && !plog.getImageUrl().isBlank())
                    ? imageGeneratorService.fetchBytesFromUrl(plog.getImageUrl())
                    : null;

            String linkedinUrn = linkedInPublisherService.publishSingleAccount(
                    user.getTenant(), targetAccount, textToPublish, imageBytes);

            long duration = System.currentTimeMillis() - startTime;

            publicationLogService.createLog(
                    user.getTenant(),
                    plog.getSourceMode() != null ? plog.getSourceMode() : SourceMode.PROJECT,
                    PublicationStatus.SUCCESS,
                    targetAccount.getAccountType(),
                    targetAccount.getEffectiveAuthorUrn(),
                    textToPublish,
                    plog.getImageUrl(),
                    linkedinUrn,
                    plog.getSourceReference() != null ? plog.getSourceReference() : "Republicación Manual",
                    null,
                    duration,
                    "deepseek-chat",
                    500
            );

            auditLogService.recordAction(user.getTenant(), user.getEmail(), "REPUBLISH_SUCCESS",
                    "Post republicado exitosamente en " + targetAccount.getDisplayName() + " (URN: " + linkedinUrn + ")");

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "¡Post republicado exitosamente en LinkedIn!",
                    "linkedinUrn", linkedinUrn
            ));
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Error al republicar post ID {}: {}", id, e.getMessage());

            publicationLogService.createLog(
                    user.getTenant(),
                    plog.getSourceMode() != null ? plog.getSourceMode() : SourceMode.PROJECT,
                    PublicationStatus.FAILED,
                    targetAccount.getAccountType(),
                    targetAccount.getEffectiveAuthorUrn(),
                    plog.getGeneratedText(),
                    plog.getImageUrl(),
                    null,
                    plog.getSourceReference() != null ? plog.getSourceReference() : "Republicación Manual",
                    "Fallo al republicar: " + e.getMessage(),
                    duration,
                    "deepseek-chat",
                    0
            );

            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "No se pudo republicar en LinkedIn: " + e.getMessage()
            ));
        }
    }

    public record PublishPreviewRequest(
            String text,
            String imageUrl
    ) {}

    @PostMapping("/preview/publish-now")
    public ResponseEntity<Map<String, Object>> publishPreviewNow(Authentication auth, @RequestBody(required = false) PublishPreviewRequest request) {
        User user = authHelper.getCurrentUser(auth);
        Tenant tenant = user.getTenant();

        String textToPublish = (request != null && request.text() != null && !request.text().isBlank())
                ? request.text()
                : null;
        String imageUrl = (request != null && request.imageUrl() != null && !request.imageUrl().isBlank())
                ? request.imageUrl()
                : null;

        if (textToPublish == null) {
            GeneratedPreviewResponse saved = draftPreviewService.getSaved(tenant.getId());
            textToPublish = saved.generatedText();
            if (imageUrl == null) imageUrl = saved.imageUrl();
        }

        if (textToPublish == null || textToPublish.isBlank()) {
            throw new IllegalArgumentException("No hay contenido de previsualización para publicar");
        }

        List<LinkedInCredential> accounts = linkedInCredentialRepository.findByTenantIdAndIsEnabledTrue(tenant.getId());
        if (accounts.isEmpty()) {
            linkedInCredentialRepository.findByTenantId(tenant.getId()).ifPresent(accounts::add);
        }
        if (accounts.isEmpty()) {
            throw new IllegalArgumentException("No hay ninguna cuenta de LinkedIn conectada o habilitada para publicar");
        }
        LinkedInCredential targetAccount = accounts.stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsPrimary()))
                .findFirst()
                .orElse(accounts.get(0));

        byte[] imageBytes = (imageUrl != null && !imageUrl.isBlank())
                ? imageGeneratorService.fetchBytesFromUrl(imageUrl)
                : null;

        long startTime = System.currentTimeMillis();
        try {
            String linkedinUrn = linkedInPublisherService.publishSingleAccount(
                    tenant, targetAccount, textToPublish, imageBytes);
            long duration = Math.max(1L, System.currentTimeMillis() - startTime);

            PublicationLog plog = publicationLogService.createLog(
                    tenant,
                    SourceMode.PROJECT,
                    PublicationStatus.SUCCESS,
                    targetAccount.getAccountType(),
                    targetAccount.getEffectiveAuthorUrn(),
                    textToPublish,
                    imageUrl,
                    linkedinUrn,
                    "Publicación Directa desde Previsualización",
                    null,
                    duration,
                    "deepseek-chat",
                    500
            );

            auditLogService.recordAction(tenant, user.getEmail(), "PUBLISH_PREVIEW_SUCCESS",
                    "Post de previsualización publicado exitosamente en " + targetAccount.getDisplayName() + " (URN: " + linkedinUrn + ")");

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "¡Post de previsualización publicado exitosamente en LinkedIn!",
                    "linkedinUrn", linkedinUrn,
                    "log", mapToResponse(plog)
            ));
        } catch (Exception e) {
            long duration = Math.max(1L, System.currentTimeMillis() - startTime);
            log.error("Error al publicar previsualización para tenant {}: {}", tenant.getId(), e.getMessage());

            publicationLogService.createLog(
                    tenant,
                    SourceMode.PROJECT,
                    PublicationStatus.FAILED,
                    targetAccount.getAccountType(),
                    targetAccount.getEffectiveAuthorUrn(),
                    textToPublish,
                    imageUrl,
                    null,
                    "Publicación Directa desde Previsualización",
                    "Fallo al publicar en LinkedIn: " + e.getMessage(),
                    duration,
                    "deepseek-chat",
                    0
            );

            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "No se pudo publicar en LinkedIn: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/trigger")
    public ResponseEntity<Map<String, Object>> triggerPipeline(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        contentPipelineService.executePipelineForTenant(user.getTenant().getId());
        auditLogService.recordAction(user.getTenant(), user.getEmail(), "MANUAL_TRIGGER", "Pipeline de publicación disparado manualmente");
        return ResponseEntity.ok(Map.of("message", "Pipeline de publicación ejecutado exitosamente"));
    }

    @GetMapping("/preview")
    public ResponseEntity<GeneratedPreviewResponse> getPreview(Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(draftPreviewService.getSaved(user.getTenant().getId()));
    }

    @PostMapping("/preview/generate")
    public ResponseEntity<GeneratedPreviewResponse> generatePreview(
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String customTopic,
            Authentication auth) {
        User user = authHelper.getCurrentUser(auth);
        ContentSource customSource = resolveContentSource(user, sourceType, mode, customTopic);
        return ResponseEntity.ok(draftPreviewService.generate(user.getTenant().getId(), customSource));
    }

    @PutMapping("/preview")
    public ResponseEntity<GeneratedPreviewResponse> updatePreview(Authentication auth, @Valid @RequestBody UpdateDraftRequest request) {
        User user = authHelper.getCurrentUser(auth);
        return ResponseEntity.ok(draftPreviewService.updateDraft(user.getTenant().getId(), request.generatedText(), request.imageUrl()));
    }

    private PublicationLogResponse mapToResponse(PublicationLog l) {
        return new PublicationLogResponse(
                l.getId(), l.getSourceMode(), l.getStatus(), l.getAccountType(), l.getAuthorUrn(),
                l.getGeneratedText(), l.getImageUrl(), l.getLinkedinPostUrn(), l.getSourceReference(),
                l.getErrorMessage(), l.getExecutionTimeMs(), l.getLlmModelUsed(),
                l.getLlmTokensUsed(), l.getPublishedAt(), l.getCreatedAt()
        );
    }
}
