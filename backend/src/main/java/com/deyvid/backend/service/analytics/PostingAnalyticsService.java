package com.deyvid.backend.service.analytics;

import com.deyvid.backend.dto.response.PostingDistributionResponse;
import com.deyvid.backend.entity.PublicationLog;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.repository.PublicationLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PostingAnalyticsService {

    private final PublicationLogRepository publicationLogRepository;
    private static final Locale LOCALE_ES = new Locale("es", "ES");

    @Transactional(readOnly = true)
    public PostingDistributionResponse getPostingDistribution(Tenant tenant) {
        if (tenant == null || tenant.getId() == null) {
            return new PostingDistributionResponse(Map.of(), Map.of(), 0, "N/A", "N/A", 0, 0, 0.0);
        }

        ZoneId zoneId = resolveZoneId(tenant);
        List<PublicationLog> logs = publicationLogRepository.findByTenantId(tenant.getId());

        Map<Integer, Long> postsByHour = new TreeMap<>();
        // Inicializar todas las horas de 0 a 23 con 0 para gráficos consistentes
        for (int h = 0; h < 24; h++) {
            postsByHour.put(h, 0L);
        }

        Map<String, Long> postsByDayOfWeek = new LinkedHashMap<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            postsByDayOfWeek.put(day.name(), 0L);
        }

        long successCount = 0;
        long failedCount = 0;

        for (PublicationLog l : logs) {
            if (l.getCreatedAt() != null) {
                ZonedDateTime zdt = l.getCreatedAt().atZone(ZoneId.of("UTC")).withZoneSameInstant(zoneId);
                int hour = zdt.getHour();
                postsByHour.put(hour, postsByHour.getOrDefault(hour, 0L) + 1);

                String dayName = zdt.getDayOfWeek().name();
                postsByDayOfWeek.put(dayName, postsByDayOfWeek.getOrDefault(dayName, 0L) + 1);
            }

            if (l.getStatus() == PublicationStatus.SUCCESS) {
                successCount++;
            } else if (l.getStatus() == PublicationStatus.FAILED) {
                failedCount++;
            }
        }

        long total = logs.size();
        double successRate = total > 0 ? (double) successCount / total * 100.0 : 100.0;

        // Hora con mayor actividad
        int bestHour = postsByHour.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(8);

        String bestObservedHour = String.format("%02d:00 hrs (%s)",
                bestHour, bestHour >= 12 ? "Tarde" : "Mañana");

        // Día con mayor actividad
        String bestDayKey = postsByDayOfWeek.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("TUESDAY");

        String bestObservedDay = DayOfWeek.valueOf(bestDayKey)
                .getDisplayName(TextStyle.FULL, LOCALE_ES).toUpperCase();

        return new PostingDistributionResponse(
                postsByHour,
                postsByDayOfWeek,
                total,
                bestObservedHour,
                bestObservedDay,
                successCount,
                failedCount,
                Math.round(successRate * 10.0) / 10.0
        );
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
