package com.deyvid.backend.service.analytics;

import com.deyvid.backend.dto.response.PostingDistributionResponse;
import com.deyvid.backend.entity.PublicationLog;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.repository.PublicationLogRepository;
import com.deyvid.backend.repository.AiUsageEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class PostingAnalyticsService {

    private final PublicationLogRepository publicationLogRepository;
    private final AiUsageEventRepository aiUsageEventRepository;
    private static final Locale LOCALE_ES = new Locale("es", "ES");

    public PostingAnalyticsService(PublicationLogRepository publicationLogRepository) {
        this(publicationLogRepository, null);
    }

    @Autowired
    public PostingAnalyticsService(
            PublicationLogRepository publicationLogRepository,
            AiUsageEventRepository aiUsageEventRepository) {
        this.publicationLogRepository = publicationLogRepository;
        this.aiUsageEventRepository = aiUsageEventRepository;
    }

    @Transactional(readOnly = true)
    public PostingDistributionResponse getPostingDistribution(Tenant tenant) {
        return getPostingDistribution(tenant, null);
    }

    @Transactional(readOnly = true)
    public PostingDistributionResponse getPostingDistribution(Tenant tenant, Integer days) {
        if (tenant == null || tenant.getId() == null) {
            return new PostingDistributionResponse(Map.of(), Map.of(), Map.of(), 0, "Sin datos", "Sin datos", 0, 0, 0, null, 0, Map.of(), 0, 0, 0, Map.of());
        }
        if (days != null && !Set.of(7, 30, 90).contains(days)) {
            throw new IllegalArgumentException("El periodo debe ser de 7, 30, 90 días o todo el historial");
        }

        ZoneId zoneId = resolveZoneId(tenant);
        List<PublicationLog> logs = days == null
                ? publicationLogRepository.findByTenantId(tenant.getId())
                : publicationLogRepository.findByTenantIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
                        tenant.getId(), periodStart(days, zoneId));

        Map<Integer, Long> postsByHour = new TreeMap<>();
        // Inicializar todas las horas de 0 a 23 con 0 para gráficos consistentes
        for (int h = 0; h < 24; h++) {
            postsByHour.put(h, 0L);
        }

        Map<String, Long> postsByDayOfWeek = new LinkedHashMap<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            postsByDayOfWeek.put(day.name(), 0L);
        }
        Map<String, Long> postsBySource = new LinkedHashMap<>();
        for (com.deyvid.backend.entity.enums.SourceMode source : com.deyvid.backend.entity.enums.SourceMode.values()) {
            postsBySource.put(source.name(), 0L);
        }

        long successCount = 0;
        long publicationsWithPublishedAtCount = 0;
        long failedCount = 0;
        long recordedTokens = 0;
        long inputTokens = 0;
        long outputTokens = 0;
        long usageEvents = 0;
        Map<String, Long> tokensByModel = new TreeMap<>();
        Map<String, Long> tokensByDay = new TreeMap<>();

        for (PublicationLog l : logs) {
            if (l.getLlmTokensUsed() != null && l.getLlmTokensUsed() > 0) {
                recordedTokens += l.getLlmTokensUsed();
                String model = l.getLlmModelUsed() == null || l.getLlmModelUsed().isBlank()
                        ? "Modelo no informado" : l.getLlmModelUsed().trim();
                tokensByModel.merge(model, l.getLlmTokensUsed().longValue(), Long::sum);
            }
            if (l.getStatus() == PublicationStatus.SUCCESS) {
                successCount++;
                if (l.getSourceMode() != null) {
                    postsBySource.merge(l.getSourceMode().name(), 1L, Long::sum);
                }
                if (l.getPublishedAt() != null) {
                    publicationsWithPublishedAtCount++;
                    ZonedDateTime zdt = l.getPublishedAt().atZone(ZoneOffset.UTC).withZoneSameInstant(zoneId);
                    int hour = zdt.getHour();
                    postsByHour.put(hour, postsByHour.getOrDefault(hour, 0L) + 1);
                    String dayName = zdt.getDayOfWeek().name();
                    postsByDayOfWeek.put(dayName, postsByDayOfWeek.getOrDefault(dayName, 0L) + 1);
                }
            } else if (l.getStatus() == PublicationStatus.FAILED) {
                failedCount++;
            }
        }

        if (aiUsageEventRepository != null) {
            LocalDateTime from = days == null ? null : periodStart(days, zoneId);
            for (Object[] row : aiUsageEventRepository.summarizeTextUsageByModel(tenant.getId(), from)) {
                String model = row[0] instanceof String value && !value.isBlank()
                        ? value.trim() : "Modelo no informado";
                long modelTokens = number(row[1]);
                inputTokens += number(row[2]);
                outputTokens += number(row[3]);
                usageEvents += number(row[4]);
                recordedTokens += modelTokens;
                tokensByModel.merge(model, modelTokens, Long::sum);
            }
            for (Object[] row : aiUsageEventRepository.summarizeTextUsageByDay(tenant.getId(), from, zoneId.getId())) {
                if (row[0] instanceof String day && day.matches("\\d{4}-\\d{2}-\\d{2}")) {
                    tokensByDay.put(day, number(row[1]));
                }
            }
        }

        long totalAttempts = successCount + failedCount;
        Double successRate = totalAttempts > 0
                ? Math.round((double) successCount / totalAttempts * 1000.0) / 10.0
                : null;

        String bestObservedHour = "Sin datos";
        String bestObservedDay = "Sin datos";
        if (successCount > 0) {
            int bestHour = postsByHour.entrySet().stream()
                    .filter(entry -> entry.getValue() > 0)
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(-1);
            if (bestHour >= 0) {
                bestObservedHour = String.format("%02d:00 hrs (%s)", bestHour, bestHour >= 12 ? "Tarde" : "Mañana");
            }
            String bestDayKey = postsByDayOfWeek.entrySet().stream()
                    .filter(entry -> entry.getValue() > 0)
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(null);
            if (bestDayKey != null) {
                bestObservedDay = DayOfWeek.valueOf(bestDayKey)
                        .getDisplayName(TextStyle.FULL, LOCALE_ES).toUpperCase(LOCALE_ES);
            }
        }

        return new PostingDistributionResponse(
                postsByHour,
                postsByDayOfWeek,
                postsBySource,
                successCount,
                bestObservedHour,
                bestObservedDay,
                successCount,
                publicationsWithPublishedAtCount,
                failedCount,
                successRate,
                recordedTokens,
                tokensByModel,
                inputTokens,
                outputTokens,
                usageEvents,
                tokensByDay
        );
    }

    private long number(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private LocalDateTime periodStart(int days, ZoneId zoneId) {
        return LocalDate.now(zoneId).minusDays(days - 1L).atStartOfDay(zoneId)
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private ZoneId resolveZoneId(Tenant tenant) {
        if (tenant != null && tenant.getTimezone() != null && !tenant.getTimezone().isBlank()) {
            try {
                return ZoneId.of(tenant.getTimezone().trim());
            } catch (Exception e) {
                log.warn("Timezone '{}' inválido. Usando America/Lima.", tenant.getTimezone());
            }
        }
        return ZoneId.of("America/Lima");
    }
}
