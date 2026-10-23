package com.deyvid.backend.service.analytics;

import com.deyvid.backend.dto.response.PostingDistributionResponse;
import com.deyvid.backend.entity.PublicationLog;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.repository.AiUsageEventRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PostingAnalyticsServiceTest {
    @Test
    void emptyHistoryDoesNotInventSuccessRateOrBestTime() {
        PostingDistributionResponse report = service(List.of()).getPostingDistribution(tenant());

        assertNull(report.successRatePercentage());
        assertEquals(0, report.totalPublishedPosts());
        assertEquals("Sin datos", report.bestObservedHour());
        assertEquals("Sin datos", report.bestObservedDay());
        assertEquals(24, report.postsByHour().size());
        assertEquals(0, report.recordedTokens());
    }

    @Test
    void distributionUsesOnlyConfirmedPostsAndTenantTimezone() {
        Tenant tenant = tenant();
        PublicationLog success = PublicationLog.builder()
                .tenant(tenant)
                .status(PublicationStatus.SUCCESS)
                .createdAt(LocalDateTime.of(2026, 10, 12, 12, 0))
                .publishedAt(LocalDateTime.of(2026, 10, 12, 13, 0))
                .llmTokensUsed(120)
                .llmModelUsed("deepseek-chat")
                .build();
        PublicationLog failed = PublicationLog.builder()
                .tenant(tenant)
                .status(PublicationStatus.FAILED)
                .createdAt(LocalDateTime.of(2026, 10, 13, 14, 0))
                .llmTokensUsed(30)
                .llmModelUsed("deepseek-chat")
                .build();
        PostingDistributionResponse report = service(List.of(success, failed)).getPostingDistribution(tenant);

        assertEquals(1, report.totalPublishedPosts());
        assertEquals(1, report.successfulPostsCount());
        assertEquals(1, report.publicationsWithPublishedAtCount());
        assertEquals(1, report.failedPostsCount());
        assertEquals(50.0, report.successRatePercentage());
        int tenantLocalHour = success.getPublishedAt().atZone(ZoneOffset.UTC)
                .withZoneSameInstant(ZoneId.of(tenant.getTimezone())).getHour();
        assertEquals(1L, report.postsByHour().get(tenantLocalHour));
        assertEquals(0L, report.postsByHour().get((tenantLocalHour + 1) % 24));
        assertEquals(1L, report.postsByDayOfWeek().get("MONDAY"));
        assertEquals(0L, report.postsByDayOfWeek().get("TUESDAY"));
        assertEquals("LUNES", report.bestObservedDay());
        assertEquals(150, report.recordedTokens());
        assertEquals(150L, report.tokensByModel().get("deepseek-chat"));
    }

    @Test
    void doesNotTreatLogCreationTimeAsAConfirmedPublicationTime() {
        Tenant tenant = tenant();
        PublicationLog legacySuccess = PublicationLog.builder()
                .tenant(tenant)
                .status(PublicationStatus.SUCCESS)
                .createdAt(LocalDateTime.of(2026, 10, 12, 13, 0))
                .publishedAt(null)
                .build();

        PostingDistributionResponse report = service(List.of(legacySuccess)).getPostingDistribution(tenant);

        assertEquals(1L, report.successfulPostsCount());
        assertEquals(0L, report.publicationsWithPublishedAtCount());
        assertEquals("Sin datos", report.bestObservedHour());
        assertEquals("Sin datos", report.bestObservedDay());
        assertEquals(0L, report.postsByHour().values().stream().mapToLong(Long::longValue).sum());
        assertEquals(0L, report.postsByDayOfWeek().values().stream().mapToLong(Long::longValue).sum());
    }

    @Test
    void sourceDistributionCountsOnlyConfirmedPostsFromTheTenantHistory() {
        Tenant tenant = tenant();
        List<PublicationLog> logs = List.of(
                PublicationLog.builder().tenant(tenant).sourceMode(SourceMode.PROJECT)
                        .status(PublicationStatus.SUCCESS).build(),
                PublicationLog.builder().tenant(tenant).sourceMode(SourceMode.RESEARCH)
                        .status(PublicationStatus.SUCCESS).build(),
                PublicationLog.builder().tenant(tenant).sourceMode(SourceMode.BACKUP)
                        .status(PublicationStatus.FAILED).build());

        PostingDistributionResponse report = service(logs).getPostingDistribution(tenant);

        assertEquals(1L, report.postsBySource().get("PROJECT"));
        assertEquals(1L, report.postsBySource().get("RESEARCH"));
        assertEquals(0L, report.postsBySource().get("BACKUP"));
    }

    @Test
    void selectedPeriodStartsAtTenantLocalDayAndQueriesOnlyThatRange() {
        Tenant tenant = tenant();
        AtomicReference<LocalDateTime> queriedFrom = new AtomicReference<>();

        service(List.of(), queriedFrom).getPostingDistribution(tenant, 7);

        ZoneId zone = ZoneId.of(tenant.getTimezone());
        LocalDateTime expectedFrom = LocalDate.now(zone).minusDays(6)
                .atStartOfDay(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        assertEquals(expectedFrom, queriedFrom.get());
    }

    @Test
    void dailyUsageReceivesThePeriodStartAsUtcAndGroupsByTenantTimezone() {
        Tenant tenant = tenant();
        tenant.setTimezone("Asia/Tokyo");
        AtomicReference<LocalDateTime> queriedFrom = new AtomicReference<>();
        AtomicReference<String> queriedTimezone = new AtomicReference<>();
        AiUsageEventRepository usage = usageRepository(List.of(), List.of(), queriedTimezone, queriedFrom);

        new PostingAnalyticsService(emptyPublicationRepository(), usage).getPostingDistribution(tenant, 7);

        ZoneId zone = ZoneId.of("Asia/Tokyo");
        LocalDateTime expectedFrom = LocalDate.now(zone).minusDays(6).atStartOfDay(zone)
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        assertEquals(expectedFrom, queriedFrom.get());
        assertEquals("Asia/Tokyo", queriedTimezone.get());
    }

    @Test
    void rejectsUnsupportedAnalyticsPeriods() {
        assertThrows(IllegalArgumentException.class,
                () -> service(List.of()).getPostingDistribution(tenant(), 14));
    }

    @Test
    void reportsActualInputAndOutputTokensFromUsageEvents() {
        Tenant tenant = tenant();
        PublicationLogRepository publications = emptyPublicationRepository();
        AiUsageEventRepository usage = usageRepository(
                java.util.Collections.singletonList(new Object[]{"gemini-flash", 150L, 100L, 50L, 2L}));

        PostingDistributionResponse report = new PostingAnalyticsService(publications, usage)
                .getPostingDistribution(tenant);

        assertEquals(150, report.recordedTokens());
        assertEquals(100, report.inputTokens());
        assertEquals(50, report.outputTokens());
        assertEquals(2, report.usageEvents());
        assertEquals(150L, report.tokensByModel().get("gemini-flash"));
    }

    @Test
    void reportsDailyTextTokenTotalsUsingTheTenantTimezone() {
        Tenant tenant = tenant();
        AtomicReference<String> queriedTimezone = new AtomicReference<>();
        AiUsageEventRepository usage = usageRepository(
                List.<Object[]>of(new Object[]{"gemini-flash", 450L, 300L, 150L, 3L}),
                List.<Object[]>of(new Object[]{"2026-10-16", 450L}, new Object[]{"2026-10-17", 120L}),
                queriedTimezone);

        PostingDistributionResponse report = new PostingAnalyticsService(emptyPublicationRepository(), usage)
                .getPostingDistribution(tenant);

        assertEquals("America/Lima", queriedTimezone.get());
        assertEquals(Map.of("2026-10-16", 450L, "2026-10-17", 120L), report.tokensByDay());
    }

    private static PostingAnalyticsService service(List<PublicationLog> logs) {
        return service(logs, null);
    }

    private static PostingAnalyticsService service(
            List<PublicationLog> logs, AtomicReference<LocalDateTime> queriedFrom) {
        PublicationLogRepository repository = (PublicationLogRepository) Proxy.newProxyInstance(
                PublicationLogRepository.class.getClassLoader(),
                new Class<?>[]{PublicationLogRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("findByTenantId")) return logs;
                    if (method.getName().equals("findByTenantIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc")) {
                        if (queriedFrom != null) queriedFrom.set((LocalDateTime) args[1]);
                        return logs;
                    }
                    if (method.getName().equals("toString")) return "InMemoryPublicationLogRepository";
                    if (method.getName().equals("hashCode")) return System.identityHashCode(proxy);
                    if (method.getName().equals("equals")) return proxy == args[0];
                    throw new UnsupportedOperationException("Método no previsto: " + method.getName());
                });
        return new PostingAnalyticsService(repository);
    }

    private static PublicationLogRepository emptyPublicationRepository() {
        return (PublicationLogRepository) Proxy.newProxyInstance(
                PublicationLogRepository.class.getClassLoader(), new Class<?>[]{PublicationLogRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("findByTenantId")) return List.of();
                    if (method.getName().equals("findByTenantIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc")) return List.of();
                    if (method.getDeclaringClass() == Object.class) return switch (method.getName()) {
                        case "toString" -> "Empty publication repository";
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == args[0];
                        default -> null;
                    };
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    private static AiUsageEventRepository usageRepository(List<Object[]> rows) {
        return usageRepository(rows, List.of(), null);
    }

    private static AiUsageEventRepository usageRepository(
            List<Object[]> rows, List<Object[]> dailyRows, AtomicReference<String> queriedTimezone) {
        return usageRepository(rows, dailyRows, queriedTimezone, null);
    }

    private static AiUsageEventRepository usageRepository(
            List<Object[]> rows,
            List<Object[]> dailyRows,
            AtomicReference<String> queriedTimezone,
            AtomicReference<LocalDateTime> queriedFrom) {
        return (AiUsageEventRepository) Proxy.newProxyInstance(
                AiUsageEventRepository.class.getClassLoader(), new Class<?>[]{AiUsageEventRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("summarizeTextUsageByModel")) return rows;
                    if (method.getName().equals("summarizeTextUsageByDay")) {
                        if (queriedTimezone != null) queriedTimezone.set((String) args[2]);
                        if (queriedFrom != null) queriedFrom.set((LocalDateTime) args[1]);
                        return dailyRows;
                    }
                    if (method.getDeclaringClass() == Object.class) return switch (method.getName()) {
                        case "toString" -> "AI usage repository";
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == args[0];
                        default -> null;
                    };
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    private static Tenant tenant() {
        return Tenant.builder().id(UUID.randomUUID()).timezone("America/Lima").build();
    }
}
