package com.deyvid.backend.service.analytics;

import com.deyvid.backend.dto.request.ComposeRequest;
import com.deyvid.backend.entity.PublicationLog;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.service.AuditLogService;
import com.deyvid.backend.service.ComposeService;
import com.deyvid.backend.service.SafeImageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.lang.reflect.Proxy;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class DailyContentSuggestionServiceTest {
    private final UUID tenantId = UUID.randomUUID();
    private final AtomicReference<List<PublicationLog>> logRows = new AtomicReference<>(List.of());
    private final AtomicReference<ComposeRequest> generatedRequest = new AtomicReference<>();
    private final AtomicInteger generationCount = new AtomicInteger();
    private final List<String> auditActions = new java.util.ArrayList<>();
    private Tenant tenant;
    private DailyContentSuggestionService service;

    @BeforeEach
    void setUp() {
        logRows.set(List.of());
        generatedRequest.set(null);
        generationCount.set(0);
        auditActions.clear();
        tenant = Tenant.builder().id(tenantId).timezone("America/Lima").appTargetCharacters(1200).build();

        PublicationLogRepository logs = repository(PublicationLogRepository.class, (method, args) -> switch (method) {
            case "findByTenantId" -> logRows.get();
            case "findTop5ByTenantIdAndStatusOrderByCreatedAtDesc" -> logRows.get().stream()
                    .filter(row -> row.getStatus() == args[1]).limit(5).toList();
            default -> throw new UnsupportedOperationException(method);
        });
        PostingAnalyticsService analytics = new PostingAnalyticsService(logs);
        ComposeService composer = new ComposeService((SafeImageService) null, (WebClient) null) {
            @Override public Proposal generate(Tenant owner, ComposeRequest request) {
                generationCount.incrementAndGet();
                generatedRequest.set(request);
                return new Proposal("Propuesta editorial basada en datos.", "prompt interno");
            }
        };
        AuditLogService audit = new AuditLogService(null) {
            @Override public void recordAction(Tenant owner, String email, String action, String details) {
                auditActions.add(action);
            }
        };
        service = new DailyContentSuggestionService(logs, analytics, composer, audit);
    }

    @Test
    void doesNotGenerateARecommendationWithoutConfirmedHistory() {
        assertThrows(IllegalArgumentException.class, () -> service.generate(tenant, "author@example.com"));
        assertEquals(0, generationCount.get());
        assertTrue(auditActions.isEmpty());
    }

    @Test
    void usesConfirmedPostsAndObservedPatternsThenReturnsAnUnpublishedSuggestion() {
        logRows.set(List.of(published("Aprendí a revisar las consultas SQL con índices parciales."),
                published("Una migración pequeña puede reducir el riesgo en producción.")));

        var suggestion = service.generate(tenant, "author@example.com");

        assertEquals(1, generationCount.get());
        assertTrue(generatedRequest.get().text().contains("consultas SQL"));
        assertTrue(generatedRequest.get().text().contains("2 publicaciones confirmadas"));
        assertEquals("Propuesta editorial basada en datos.", suggestion.text());
        assertEquals(2, suggestion.basedOnPublications());
        assertTrue(suggestion.rationale().contains("referencia de tu historial"));
        assertEquals(List.of("DAILY_CONTENT_SUGGESTION_GENERATED"), auditActions);
    }

    @Test
    void ignoresSuccessfulEntriesWithoutTextAsSuggestionContext() {
        PublicationLog noText = published("   ");
        logRows.set(List.of(noText));

        assertThrows(IllegalArgumentException.class, () -> service.generate(tenant, "author@example.com"));
        assertEquals(0, generationCount.get());
    }

    @Test
    void usesTheAnalyticsFallbackWhenTheTenantTimezoneIsInvalid() {
        tenant.setTimezone("Not/A_Timezone");
        logRows.set(List.of(published("Aprendí algo práctico al mantener una aplicación.")));

        var suggestion = service.generate(tenant, "author@example.com");

        assertTrue(suggestion.rationale().contains("(America/Lima)"));
    }

    private PublicationLog published(String text) {
        return PublicationLog.builder()
                .tenant(tenant)
                .sourceMode(SourceMode.RESEARCH)
                .status(PublicationStatus.SUCCESS)
                .generatedText(text)
                .createdAt(LocalDateTime.now())
                .publishedAt(LocalDateTime.now())
                .build();
    }

    private static <T> T repository(Class<T> type, RepositoryCall call) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> {
            if (method.getDeclaringClass() == Object.class) return switch (method.getName()) {
                case "toString" -> type.getSimpleName() + " test proxy";
                case "hashCode" -> System.identityHashCode(proxy);
                case "equals" -> proxy == args[0];
                default -> null;
            };
            return call.invoke(method.getName(), args == null ? new Object[0] : args);
        }));
    }

    @FunctionalInterface
    private interface RepositoryCall {
        Object invoke(String method, Object[] args);
    }
}
