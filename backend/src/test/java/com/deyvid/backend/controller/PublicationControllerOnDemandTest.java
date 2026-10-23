package com.deyvid.backend.controller;

import com.deyvid.backend.dto.response.SwipeBatchResponse;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.repository.DraftPreviewRepository;
import com.deyvid.backend.repository.FeedbackIaRepository;
import com.deyvid.backend.repository.LinkedInCredentialRepository;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.repository.TenantRepository;
import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.ai.ContentGeneratorService;
import com.deyvid.backend.service.DraftPreviewService;
import com.deyvid.backend.service.ai.ImageGeneratorService;
import com.deyvid.backend.service.ai.VectorStoreService;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.cache.GenerationCacheService;
import com.deyvid.backend.service.linkedin.ContentSource;
import com.deyvid.backend.service.linkedin.LinkedInPublisherService;
import com.deyvid.backend.service.PublicationLogService;
import com.deyvid.backend.service.pipeline.ContentPipelineService;
import com.deyvid.backend.service.source.BackupTopicService;
import com.deyvid.backend.service.source.GitHubSourceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PublicationControllerOnDemandTest {

    private PublicationController controller;
    private ContentGeneratorService contentGeneratorService;
    private ImageGeneratorService imageGeneratorService;
    private GenerationCacheService generationCacheService;
    private AuthHelper authHelper;
    private TenantRepository tenantRepository;
    private BackupTopicService backupTopicService;
    private GitHubSourceService gitHubSourceService;

    private User testUser;
    private Tenant testTenant;

    @BeforeEach
    void setUp() {
        authHelper = mock(AuthHelper.class);
        tenantRepository = mock(TenantRepository.class);
        contentGeneratorService = mock(ContentGeneratorService.class);
        imageGeneratorService = mock(ImageGeneratorService.class);
        generationCacheService = new GenerationCacheService();
        backupTopicService = mock(BackupTopicService.class);
        gitHubSourceService = mock(GitHubSourceService.class);

        controller = new PublicationController(
                authHelper,
                tenantRepository,
                mock(PublicationLogService.class),
                mock(PublicationLogRepository.class),
                mock(ContentPipelineService.class),
                mock(DraftPreviewService.class),
                contentGeneratorService,
                imageGeneratorService,
                mock(LinkedInPublisherService.class),
                mock(LinkedInCredentialRepository.class),
                mock(FeedbackIaRepository.class),
                mock(DraftPreviewRepository.class),
                mock(VectorStoreService.class),
                mock(AuditLogService.class),
                gitHubSourceService,
                backupTopicService,
                generationCacheService,
                mock(com.deyvid.backend.service.ApprovedPublicationService.class)
        );

        testTenant = new Tenant();
        UUID tenantId = UUID.randomUUID();
        testTenant.setId(tenantId);
        testTenant.setSystemPrompt("Prompt de prueba");

        testUser = new User();
        testUser.setTenant(testTenant);

        when(authHelper.getCurrentUser(any())).thenReturn(testUser);
        when(tenantRepository.findById(eq(tenantId))).thenReturn(Optional.of(testTenant));
        when(backupTopicService.previewNextTopic(any())).thenReturn(Optional.of(
                new ContentSource(SourceMode.RESEARCH, "Kafka vs RabbitMQ", "Detalles", null, "https://link.com")
        ));
    }

    @Test
    void testSwipeBatchLazyGeneratesOnlyVariantAAndCachesIt() {
        when(contentGeneratorService.generateVersionWithUsage(any(), any(), eq("COMPARATIVE_B2B"), any()))
                .thenReturn(new ContentGeneratorService.GeneratedContent(
                        "Texto de la variante A", "deepseek-flash", 40, 24, 64));

        Authentication auth = mock(Authentication.class);
        ResponseEntity<SwipeBatchResponse> response = controller.generateSwipeBatch(
                "RESEARCH", "RESEARCH", null, true, "MICRO", auth
        );

        assertNotNull(response.getBody());
        assertEquals(3, response.getBody().versions().size());

        SwipeBatchResponse.SwipeVersionDto vA = response.getBody().versions().get(0);
        SwipeBatchResponse.SwipeVersionDto vB = response.getBody().versions().get(1);
        SwipeBatchResponse.SwipeVersionDto vC = response.getBody().versions().get(2);

        assertEquals("Texto de la variante A", vA.textoGenerado());
        assertEquals(64, vA.tokensUsed());
        assertNull(vA.costUsd());
        assertEquals("deepseek-flash", vA.model());
        assertNull(vB.textoGenerado(), "Variante B debe ser null cuando lazy=true");
        assertNull(vC.textoGenerado(), "Variante C debe ser null cuando lazy=true");

        // Solo 1 llamada al servicio de IA
        verify(contentGeneratorService, times(1)).generateVersionWithUsage(any(), any(), eq("COMPARATIVE_B2B"), any());
        verify(contentGeneratorService, never()).generateVersionWithUsage(any(), any(), eq("STORYTELLER"), any());
        verify(contentGeneratorService, never()).generateVersionWithUsage(any(), any(), eq("PROVOCATIVE"), any());

        // Debe haberse guardado en caché
        String cacheKeyA = GenerationCacheService.buildKey(
                testTenant.getId(), "RESEARCH", "Kafka vs RabbitMQ", "COMPARATIVE_B2B", "MICRO"
        );
        Optional<SwipeBatchResponse.SwipeVersionDto> cached = generationCacheService.get(cacheKeyA);
        assertTrue(cached.isPresent());
        assertEquals("Texto de la variante A", cached.get().textoGenerado());
    }

    @Test
    void testSingleVersionUsesCacheWhenAvailable() {
        String cacheKey = GenerationCacheService.buildKey(
                testTenant.getId(), "RESEARCH", "Kafka vs RabbitMQ", "STORYTELLER", "MICRO"
        );
        SwipeBatchResponse.SwipeVersionDto preCached = new SwipeBatchResponse.SwipeVersionDto(
                "id-123", "STORYTELLER", "Titulo Estructura", "Texto en Cache", "http://img.jpg", 250, null, null, "deepseek-flash"
        );
        generationCacheService.put(cacheKey, preCached);

        Authentication auth = mock(Authentication.class);
        ResponseEntity<SwipeBatchResponse.SwipeVersionDto> result = controller.generateSingleVersion(
                "STORYTELLER", "RESEARCH", "RESEARCH", null, "MICRO", auth
        );

        assertNotNull(result.getBody());
        assertEquals("Texto en Cache", result.getBody().textoGenerado());

        // Cero llamadas al servicio de IA por haber hit en caché
        verify(contentGeneratorService, never()).generateVersionWithUsage(any(), any(), any(), any());
    }

    @Test
    void testSingleVersionGeneratesAndCachesWhenCacheMiss() {
        when(contentGeneratorService.generateVersionWithUsage(any(), any(), eq("PROVOCATIVE"), eq("MICRO")))
                .thenReturn(new ContentGeneratorService.GeneratedContent(
                        "Texto Provocativo Nuevo", "deepseek-flash", 20, 15, 35));

        Authentication auth = mock(Authentication.class);
        ResponseEntity<SwipeBatchResponse.SwipeVersionDto> result = controller.generateSingleVersion(
                "PROVOCATIVE", "RESEARCH", "RESEARCH", null, "MICRO", auth
        );

        assertNotNull(result.getBody());
        assertEquals("Texto Provocativo Nuevo", result.getBody().textoGenerado());
        verify(contentGeneratorService, times(1)).generateVersionWithUsage(any(), any(), eq("PROVOCATIVE"), eq("MICRO"));
        assertEquals(35, result.getBody().tokensUsed());
        assertNull(result.getBody().costUsd());

        // Se debio guardar en cache
        String cacheKey = GenerationCacheService.buildKey(
                testTenant.getId(), "RESEARCH", "Kafka vs RabbitMQ", "PROVOCATIVE", "MICRO"
        );
        Optional<SwipeBatchResponse.SwipeVersionDto> cached = generationCacheService.get(cacheKey);
        assertTrue(cached.isPresent());
        assertEquals("Texto Provocativo Nuevo", cached.get().textoGenerado());
    }
}
