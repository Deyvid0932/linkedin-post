package com.deyvid.backend.service;

import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.repository.AiUsageEventRepository;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.repository.TenantRepository;
import com.deyvid.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AdminOverviewServiceTest {
    private static final ZoneId PLATFORM_ZONE = ZoneId.of("America/Lima");

    @Test
    void buildsThirtyDaySeriesFromProviderReportedTextUsage() {
        LocalDate today = LocalDate.now(PLATFORM_ZONE);
        AtomicReference<LocalDateTime> publicationQueryFrom = new AtomicReference<>();
        AtomicReference<LocalDateTime> reportedUsageQueryFrom = new AtomicReference<>();
        AtomicReference<LocalDateTime> reportedRequestsQueryFrom = new AtomicReference<>();
        AtomicReference<LocalDateTime> imageGenerationsQueryFrom = new AtomicReference<>();
        AtomicReference<LocalDateTime> modelUsageQueryFrom = new AtomicReference<>();
        UserRepository users = repository(UserRepository.class, (method, args) -> switch (method) {
            case "count" -> 9L;
            case "countByIsActiveTrue" -> 8L;
            default -> throw new UnsupportedOperationException(method);
        });
        TenantRepository tenants = repository(TenantRepository.class, (method, args) -> {
            if (method.equals("count")) return 7L;
            throw new UnsupportedOperationException(method);
        });
        PublicationLogRepository publications = repository(PublicationLogRepository.class, (method, args) -> {
            if (method.equals("countByStatus")) {
                return args[0] == PublicationStatus.SUCCESS ? 6L : 2L;
            }
            if (method.equals("summarizePublicationOutcomesByDaySince")) {
                publicationQueryFrom.set((LocalDateTime) args[0]);
                return List.of(
                        new Object[] { today.minusDays(1).toString(), "SUCCESS", 2L },
                        new Object[] { today.minusDays(1).toString(), "SUCCESS", 1L },
                        new Object[] { today.minusDays(1).toString(), "FAILED", 2L },
                        new Object[] { today.toString(), "FAILED", 1L },
                        new Object[] { today.minusDays(40).toString(), "SUCCESS", 99L });
            }
            throw new UnsupportedOperationException(method);
        });
        AiUsageEventRepository usageEvents = repository(AiUsageEventRepository.class, (method, args) -> {
            if (method.equals("firstReportedTextUsageAt")) return today.minusDays(2).atTime(7, 0);
            if (method.equals("countReportedTextRequestsSince")) {
                reportedRequestsQueryFrom.set((LocalDateTime) args[0]);
                return 3L;
            }
            if (method.equals("summarizeImageGenerationsByDaySince")) {
                imageGenerationsQueryFrom.set((LocalDateTime) args[0]);
                return List.of(
                        new Object[] { today.minusDays(1).toString(), 1L },
                        new Object[] { today.toString(), 3L });
            }
            if (method.equals("firstImageGenerationAt")) return today.minusDays(10).atTime(7, 0);
            if (method.equals("summarizeReportedTextTokensByDaySince")) {
                reportedUsageQueryFrom.set((LocalDateTime) args[0]);
                return List.of(
                        new Object[] { today.minusDays(1).toString(), 40L },
                        new Object[] { today.toString(), 35L });
            }
            if (method.equals("summarizeTextUsageByProviderAndModelSince")) {
                modelUsageQueryFrom.set((LocalDateTime) args[0]);
                return List.<Object[]>of(new Object[] { "nano-gpt", "text-model", 3L, 120L, 80L, 200L });
            }
            throw new UnsupportedOperationException(method);
        });

        var metrics = new ApiHttp429MetricService(null) {
            @Override public Map<LocalDate, Map<String, Long>> countByDateAndRouteGroup(LocalDate from, LocalDate to) {
                return Map.of(today, Map.of("auth", 2L, "ai", 3L, "api", 7L));
            }

            @Override public LocalDate trackingStartedOn() {
                return today.minusDays(2);
            }
        };
        var apiRequestMetrics = new ApiRequestMetricService(null) {
            @Override public Map<LocalDate, Map<Integer, Long>> countByDateAndStatusClass(LocalDate from, LocalDate to) {
                return Map.of(
                        today.minusDays(1), Map.of(2, 20L, 4, 1L),
                        today, Map.of(2, 8L, 4, 2L, 5, 1L));
            }

            @Override public LocalDate trackingStartedOn() {
                return today.minusDays(4);
            }
        };
        var service = new AdminOverviewService(users, tenants, publications, usageEvents, metrics, apiRequestMetrics);
        var overview = service.getOverview();

        assertEquals(9L, overview.totalUsers());
        assertEquals(8L, overview.activeUsers());
        assertEquals(6L, overview.publishedPosts());
        assertEquals(2L, overview.failedPosts());
        assertEquals(30, overview.periodDays());
        assertEquals(today.minusDays(4), overview.apiRequestMetricsStartedOn());
        assertEquals(11L, overview.apiRequestsToday());
        assertEquals(8L, overview.successfulApiRequestsToday());
        assertEquals(0L, overview.redirectedApiRequestsToday());
        assertEquals(2L, overview.clientErrorApiRequestsToday());
        assertEquals(1L, overview.serverErrorApiRequestsToday());
        assertEquals(30, overview.dailyApiRequests().size());
        assertEquals(today.minusDays(29), overview.dailyApiRequests().get(0).date());
        assertEquals(false, overview.dailyApiRequests().get(0).tracked());
        assertEquals(21L, overview.dailyApiRequests().get(28).successful()
                + overview.dailyApiRequests().get(28).clientErrors());
        assertEquals(true, overview.dailyApiRequests().get(29).tracked());
        assertEquals(75L, overview.recordedTokensInPeriod());
        assertEquals(today.minusDays(2), overview.textMetricsStartedOn());
        assertEquals(3L, overview.reportedTextRequestsInPeriod());
        assertEquals(4L, overview.successfulImageGenerationsInPeriod());
        assertEquals(today.minusDays(10), overview.imageMetricsStartedOn());
        assertEquals(30, overview.dailyImageGenerations().size());
        assertEquals(false, overview.dailyImageGenerations().get(18).tracked());
        assertEquals(true, overview.dailyImageGenerations().get(19).tracked());
        assertEquals(true, overview.dailyImageGenerations().get(29).tracked());
        assertEquals(1L, overview.dailyImageGenerations().get(28).successfulGenerations());
        assertEquals(3L, overview.dailyImageGenerations().get(29).successfulGenerations());
        assertEquals(12L, overview.http429ResponsesInPeriod());
        assertEquals(Map.of("auth", 2L, "ai", 3L, "api", 7L), overview.http429ResponsesByRouteGroupInPeriod());
        assertEquals(30, overview.dailyHttp429Responses().size());
        assertEquals(today.minusDays(29), overview.dailyHttp429Responses().get(0).date());
        assertEquals(false, overview.dailyHttp429Responses().get(26).tracked());
        assertEquals(true, overview.dailyHttp429Responses().get(27).tracked());
        assertEquals(true, overview.dailyHttp429Responses().get(29).tracked());
        assertEquals(today.minusDays(2), overview.http429MetricsStartedOn());
        assertEquals(0L, overview.dailyHttp429Responses().get(28).auth());
        assertEquals(2L, overview.dailyHttp429Responses().get(29).auth());
        assertEquals(3L, overview.dailyHttp429Responses().get(29).ai());
        assertEquals(7L, overview.dailyHttp429Responses().get(29).api());
        assertEquals(30, overview.dailyReportedTextTokens().size());
        assertEquals(false, overview.dailyReportedTextTokens().get(26).tracked());
        assertEquals(true, overview.dailyReportedTextTokens().get(27).tracked());
        assertEquals(true, overview.dailyReportedTextTokens().get(28).tracked());
        assertEquals(40L, overview.dailyReportedTextTokens().get(28).tokens());
        assertEquals(35L, overview.dailyReportedTextTokens().get(29).tokens());
        assertEquals(0L, overview.dailyReportedTextTokens().get(27).tokens());
        assertEquals(30, overview.dailyPublicationOutcomes().size());
        assertEquals(3L, overview.dailyPublicationOutcomes().get(28).published());
        assertEquals(2L, overview.dailyPublicationOutcomes().get(28).failed());
        assertEquals(0L, overview.dailyPublicationOutcomes().get(27).published());
        assertEquals(1L, overview.dailyPublicationOutcomes().get(29).failed());
        assertEquals(1, overview.textUsageByModel().size());
        assertEquals("nano-gpt", overview.textUsageByModel().get(0).provider());
        assertEquals(3L, overview.textUsageByModel().get(0).requestCount());
        assertEquals(200L, overview.textUsageByModel().get(0).totalTokens());

        LocalDateTime limaStart = today.minusDays(29).atStartOfDay();
        LocalDateTime utcStart = limaStart.atZone(PLATFORM_ZONE)
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        assertEquals(limaStart, publicationQueryFrom.get());
        assertEquals(limaStart, reportedUsageQueryFrom.get());
        assertEquals(utcStart, modelUsageQueryFrom.get());
        assertEquals(utcStart, reportedRequestsQueryFrom.get());
        assertEquals(limaStart, imageGenerationsQueryFrom.get());

        var week = service.getOverview(7);
        assertEquals(7, week.periodDays());
        assertEquals(7, week.dailyReportedTextTokens().size());
        assertEquals(7, week.dailyPublicationOutcomes().size());
        assertEquals(7, week.dailyHttp429Responses().size());
        assertEquals(7, week.dailyApiRequests().size());
        LocalDateTime weekStart = today.minusDays(6).atStartOfDay();
        assertEquals(weekStart, publicationQueryFrom.get());
        assertEquals(weekStart, reportedUsageQueryFrom.get());
        assertEquals(weekStart.atZone(PLATFORM_ZONE).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime(),
                modelUsageQueryFrom.get());
        assertEquals(weekStart.atZone(PLATFORM_ZONE).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime(),
                reportedRequestsQueryFrom.get());

        var quarter = service.getOverview(90);
        assertEquals(90, quarter.periodDays());
        assertEquals(90, quarter.dailyReportedTextTokens().size());
        assertEquals(90, quarter.dailyPublicationOutcomes().size());
        assertEquals(today.minusDays(89).atStartOfDay(), publicationQueryFrom.get());
    }

    @Test
    void rejectsUnsupportedOverviewPeriods() {
        var service = new AdminOverviewService(null, null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.getOverview(14));
    }

    private static <T> T repository(Class<T> type, RepositoryCall call) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, (proxy, method, args) -> {
            if (method.getDeclaringClass() == Object.class) {
                return switch (method.getName()) {
                    case "toString" -> type.getSimpleName() + " test proxy";
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    default -> null;
                };
            }
            return call.invoke(method.getName(), args == null ? new Object[0] : args);
        }));
    }

    @FunctionalInterface
    private interface RepositoryCall {
        Object invoke(String method, Object[] args);
    }
}
