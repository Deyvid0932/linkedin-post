package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.AdminDailyTextUsageResponse;
import com.deyvid.backend.dto.response.AdminDailyApiRequestCountResponse;
import com.deyvid.backend.dto.response.AdminDailyHttp429CountResponse;
import com.deyvid.backend.dto.response.AdminDailyImageGenerationResponse;
import com.deyvid.backend.dto.response.AdminDailyPublicationOutcomeResponse;
import com.deyvid.backend.dto.response.AdminModelTextUsageResponse;
import com.deyvid.backend.dto.response.AdminOverviewResponse;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.repository.AiUsageEventRepository;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.repository.TenantRepository;
import com.deyvid.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminOverviewService {
    private static final ZoneId PLATFORM_ZONE = ZoneId.of("America/Lima");
    private static final List<Integer> ALLOWED_PERIOD_DAYS = List.of(7, 30, 90);

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final PublicationLogRepository publicationLogRepository;
    private final AiUsageEventRepository aiUsageEventRepository;
    private final ApiHttp429MetricService http429MetricService;
    private final ApiRequestMetricService apiRequestMetricService;

    public AdminOverviewService(
            UserRepository userRepository,
            TenantRepository tenantRepository,
            PublicationLogRepository publicationLogRepository,
            AiUsageEventRepository aiUsageEventRepository,
            ApiHttp429MetricService http429MetricService,
            ApiRequestMetricService apiRequestMetricService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.publicationLogRepository = publicationLogRepository;
        this.aiUsageEventRepository = aiUsageEventRepository;
        this.http429MetricService = http429MetricService;
        this.apiRequestMetricService = apiRequestMetricService;
    }

    @Transactional(readOnly = true)
    public AdminOverviewResponse getOverview() {
        return getOverview(30);
    }

    @Transactional(readOnly = true)
    public AdminOverviewResponse getOverview(int periodDays) {
        if (!ALLOWED_PERIOD_DAYS.contains(periodDays)) {
            throw new IllegalArgumentException("El periodo debe ser de 7, 30 o 90 días.");
        }
        LocalDate today = LocalDate.now(PLATFORM_ZONE);
        LocalDate startDate = today.minusDays(periodDays - 1L);
        LocalDateTime from = startDate.atStartOfDay();
        LocalDateTime fromUtc = from.atZone(PLATFORM_ZONE)
                .withZoneSameInstant(ZoneOffset.UTC)
                .toLocalDateTime();

        LocalDateTime firstReportedTextUsageAt = aiUsageEventRepository.firstReportedTextUsageAt();
        LocalDate textMetricsStartedOn = firstReportedTextUsageAt == null
                ? null
                : firstReportedTextUsageAt.atZone(ZoneOffset.UTC)
                        .withZoneSameInstant(PLATFORM_ZONE)
                        .toLocalDate();

        Map<LocalDate, Long> tokensByDate = new HashMap<>();
        for (Object[] row : aiUsageEventRepository.summarizeReportedTextTokensByDaySince(from)) {
            if (row == null || row.length < 2 || !(row[0] instanceof String date)) continue;
            try {
                LocalDate day = LocalDate.parse(date);
                if (!day.isBefore(startDate) && !day.isAfter(today)) {
                    tokensByDate.merge(day, numericValue(row[1]), Long::sum);
                }
            } catch (RuntimeException ignored) {
                // Ignore malformed database rows rather than failing the entire admin overview.
            }
        }

        Map<LocalDate, Long> imageGenerationsByDate = new HashMap<>();
        LocalDateTime firstImageGenerationAt = aiUsageEventRepository.firstImageGenerationAt();
        LocalDate imageMetricsStartedOn = firstImageGenerationAt == null
                ? null
                : firstImageGenerationAt.atZone(ZoneOffset.UTC)
                        .withZoneSameInstant(PLATFORM_ZONE)
                        .toLocalDate();
        for (Object[] row : aiUsageEventRepository.summarizeImageGenerationsByDaySince(from)) {
            if (row == null || row.length < 2 || !(row[0] instanceof String date)) continue;
            try {
                LocalDate day = LocalDate.parse(date);
                if (!day.isBefore(startDate) && !day.isAfter(today)) {
                    imageGenerationsByDate.merge(day, numericValue(row[1]), Long::sum);
                }
            } catch (RuntimeException ignored) {
                // Ignore malformed database rows rather than failing the entire admin overview.
            }
        }

        List<AdminDailyTextUsageResponse> dailyUsage = new ArrayList<>(periodDays);
        List<AdminDailyImageGenerationResponse> dailyImageGenerations = new ArrayList<>(periodDays);
        Map<LocalDate, long[]> publicationOutcomesByDate = new HashMap<>();
        for (Object[] row : publicationLogRepository.summarizePublicationOutcomesByDaySince(from)) {
            if (row == null || row.length < 3 || !(row[0] instanceof String date)) continue;
            try {
                LocalDate day = LocalDate.parse(date);
                String status = row[1] instanceof String value ? value : "";
                if (day.isBefore(startDate) || day.isAfter(today)) continue;
                long[] counts = publicationOutcomesByDate.computeIfAbsent(day, ignored -> new long[2]);
                if (PublicationStatus.SUCCESS.name().equals(status)) counts[0] += numericValue(row[2]);
                if (PublicationStatus.FAILED.name().equals(status)) counts[1] += numericValue(row[2]);
            } catch (RuntimeException ignored) {
                // Ignore malformed database rows rather than failing the entire admin overview.
            }
        }

        List<AdminDailyPublicationOutcomeResponse> dailyPublicationOutcomes = new ArrayList<>(periodDays);
        long reportedTokens = 0;
        long successfulImageGenerations = 0;
        for (int offset = 0; offset < periodDays; offset++) {
            LocalDate day = startDate.plusDays(offset);
            long tokens = tokensByDate.getOrDefault(day, 0L);
            reportedTokens += tokens;
            boolean textTracked = textMetricsStartedOn != null && !day.isBefore(textMetricsStartedOn);
            dailyUsage.add(new AdminDailyTextUsageResponse(day, textTracked, tokens));
            boolean imageTracked = imageMetricsStartedOn != null && !day.isBefore(imageMetricsStartedOn);
            long imageCount = imageTracked ? imageGenerationsByDate.getOrDefault(day, 0L) : 0L;
            successfulImageGenerations += imageCount;
            dailyImageGenerations.add(new AdminDailyImageGenerationResponse(day, imageTracked, imageCount));
            long[] outcomes = publicationOutcomesByDate.getOrDefault(day, new long[2]);
            dailyPublicationOutcomes.add(new AdminDailyPublicationOutcomeResponse(day, outcomes[0], outcomes[1]));
        }

        List<AdminModelTextUsageResponse> modelUsage = aiUsageEventRepository
                .summarizeTextUsageByProviderAndModelSince(fromUtc, PageRequest.of(0, 12))
                .stream()
                .filter(row -> row != null && row.length >= 6)
                .map(this::toModelUsage)
                .toList();
        long reportedTextRequests = aiUsageEventRepository.countReportedTextRequestsSince(fromUtc);
        Map<LocalDate, Map<String, Long>> http429ByDay = http429MetricService
                .countByDateAndRouteGroup(startDate, today);
        LocalDate http429MetricsStartedOn = http429MetricService.trackingStartedOn();
        Map<String, Long> http429ByRouteGroup = new HashMap<>(Map.of("auth", 0L, "ai", 0L, "api", 0L));
        List<AdminDailyHttp429CountResponse> dailyHttp429Responses = new ArrayList<>(periodDays);
        for (int offset = 0; offset < periodDays; offset++) {
            LocalDate day = startDate.plusDays(offset);
            Map<String, Long> groupCounts = http429ByDay.getOrDefault(day, Map.of());
            long auth = Math.max(0, groupCounts.getOrDefault("auth", 0L));
            long ai = Math.max(0, groupCounts.getOrDefault("ai", 0L));
            long api = Math.max(0, groupCounts.getOrDefault("api", 0L));
            boolean tracked = (http429MetricsStartedOn != null && !day.isBefore(http429MetricsStartedOn))
                    || http429ByDay.containsKey(day);
            dailyHttp429Responses.add(new AdminDailyHttp429CountResponse(day, tracked, auth, ai, api));
            http429ByRouteGroup.merge("auth", auth, Long::sum);
            http429ByRouteGroup.merge("ai", ai, Long::sum);
            http429ByRouteGroup.merge("api", api, Long::sum);
        }
        long http429Responses = http429ByRouteGroup.values().stream().mapToLong(Long::longValue).sum();

        LocalDate apiMetricsStartedOn = apiRequestMetricService.trackingStartedOn();
        Map<LocalDate, Map<Integer, Long>> apiRequestsByDay = apiRequestMetricService
                .countByDateAndStatusClass(startDate, today);
        List<AdminDailyApiRequestCountResponse> dailyApiRequests = new ArrayList<>(periodDays);
        long apiRequestsToday = 0;
        long successfulApiRequestsToday = 0;
        long redirectedApiRequestsToday = 0;
        long clientErrorApiRequestsToday = 0;
        long serverErrorApiRequestsToday = 0;
        for (int offset = 0; offset < periodDays; offset++) {
            LocalDate day = startDate.plusDays(offset);
            Map<Integer, Long> statusCounts = apiRequestsByDay.getOrDefault(day, Map.of());
            long successful = countForStatus(statusCounts, 2);
            long redirected = countForStatus(statusCounts, 3);
            long clientErrors = countForStatus(statusCounts, 4);
            long serverErrors = countForStatus(statusCounts, 5);
            boolean tracked = apiMetricsStartedOn != null && !day.isBefore(apiMetricsStartedOn);
            dailyApiRequests.add(new AdminDailyApiRequestCountResponse(
                    day, tracked, successful, redirected, clientErrors, serverErrors));
            if (day.equals(today)) {
                apiRequestsToday = successful + redirected + clientErrors + serverErrors;
                successfulApiRequestsToday = successful;
                redirectedApiRequestsToday = redirected;
                clientErrorApiRequestsToday = clientErrors;
                serverErrorApiRequestsToday = serverErrors;
            }
        }

        return new AdminOverviewResponse(
                userRepository.count(),
                userRepository.countByIsActiveTrue(),
                tenantRepository.count(),
                publicationLogRepository.countByStatus(PublicationStatus.SUCCESS),
                publicationLogRepository.countByStatus(PublicationStatus.FAILED),
                periodDays,
                apiMetricsStartedOn,
                apiRequestsToday,
                successfulApiRequestsToday,
                redirectedApiRequestsToday,
                clientErrorApiRequestsToday,
                serverErrorApiRequestsToday,
                List.copyOf(dailyApiRequests),
                reportedTokens,
                textMetricsStartedOn,
                Math.max(0, reportedTextRequests),
                Math.max(0, http429Responses),
                http429MetricsStartedOn,
                Map.copyOf(http429ByRouteGroup),
                List.copyOf(dailyHttp429Responses),
                List.copyOf(dailyUsage),
                modelUsage,
                List.copyOf(dailyPublicationOutcomes),
                Math.max(0, successfulImageGenerations),
                imageMetricsStartedOn,
                List.copyOf(dailyImageGenerations));
    }

    private long countForStatus(Map<Integer, Long> counts, int statusClass) {
        return Math.max(0, counts.getOrDefault(statusClass, 0L));
    }

    private AdminModelTextUsageResponse toModelUsage(Object[] row) {
        return new AdminModelTextUsageResponse(
                textValue(row[0]),
                textValue(row[1]),
                numericValue(row[2]),
                numericValue(row[3]),
                numericValue(row[4]),
                numericValue(row[5]));
    }

    private String textValue(Object value) {
        return value instanceof String text && !text.isBlank() ? text : "No informado";
    }

    private long numericValue(Object value) {
        return value instanceof Number number ? Math.max(0, number.longValue()) : 0;
    }
}
