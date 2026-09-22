package com.deyvid.backend.service.analytics;

import com.deyvid.backend.dto.response.OptimalSlotStatusResponse;
import com.deyvid.backend.entity.Tenant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;

@Service
@Slf4j
public class OptimalPostingTimeService {

    private static final Locale LOCALE_ES = new Locale("es", "ES");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);

    public OptimalSlotStatusResponse evaluateCurrentPostingSlot(Tenant tenant) {
        ZoneId zoneId = resolveZoneId(tenant);
        ZonedDateTime now = ZonedDateTime.now(zoneId);
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();

        // 1. Identificar si está en una Franja Dorada
        boolean isMorningPeak = isTimeBetween(time, LocalTime.of(7, 30), LocalTime.of(9, 30));
        boolean isLunchPeak = isTimeBetween(time, LocalTime.of(12, 30), LocalTime.of(14, 30));
        boolean isEveningPeak = isTimeBetween(time, LocalTime.of(18, 0), LocalTime.of(19, 45));

        boolean isGoldenDay = dayOfWeek == DayOfWeek.TUESDAY || dayOfWeek == DayOfWeek.WEDNESDAY || dayOfWeek == DayOfWeek.THURSDAY;

        String trafficLevel;
        String slotName;
        boolean idealNow;

        if (isMorningPeak) {
            trafficLevel = "GOLDEN";
            slotName = "🌅 Café antes de la Daily (Pico #1)";
            idealNow = true;
        } else if (isLunchPeak) {
            trafficLevel = "GOLDEN";
            slotName = "🍲 Almuerzo Tech & Pausa Móvil (Pico #2)";
            idealNow = true;
        } else if (isEveningPeak) {
            trafficLevel = "GOLDEN";
            slotName = "🌆 Fin de Jornada / After-Work (Pico #3)";
            idealNow = true;
        } else if (isTimeBetween(time, LocalTime.of(9, 30), LocalTime.of(12, 30)) ||
                   isTimeBetween(time, LocalTime.of(14, 30), LocalTime.of(18, 0))) {
            trafficLevel = "MODERATE";
            slotName = "☕ Horario Productivo (Tráfico Moderado)";
            idealNow = false;
        } else {
            trafficLevel = "OFF_PEAK";
            slotName = "🌙 Fuera de Horario Laboral Tech (Baja Interacción)";
            idealNow = false;
        }

        // 2. Próxima franja dorada recomendada
        OptimalSlotStatusResponse.NextOptimalSlotDto nextSlot = calculateNextGoldenSlot(now);

        // 3. Ventanas pico informativas
        List<OptimalSlotStatusResponse.PeakWindowDto> peakWindows = List.of(
                new OptimalSlotStatusResponse.PeakWindowDto(
                        "Pico #1: Café antes de la Daily",
                        "07:30 AM – 09:30 AM",
                        "Revisión rápida en móvil antes de abrir el IDE",
                        "⭐⭐⭐⭐⭐",
                        isMorningPeak
                ),
                new OptimalSlotStatusResponse.PeakWindowDto(
                        "Pico #2: Almuerzo Tech",
                        "12:30 PM – 02:30 PM",
                        "Mayor lectura y debate en comunidad durante la comida",
                        "⭐⭐⭐⭐⭐",
                        isLunchPeak
                ),
                new OptimalSlotStatusResponse.PeakWindowDto(
                        "Pico #3: Fin de Jornada / After-Work",
                        "06:00 PM – 07:45 PM",
                        "Desconexión laboral y networking nocturno",
                        "⭐⭐⭐⭐",
                        isEveningPeak
                )
        );

        String formattedLocalTime = now.format(TIME_FORMATTER);
        String formattedDay = dayOfWeek.getDisplayName(TextStyle.FULL, LOCALE_ES).toUpperCase();

        return new OptimalSlotStatusResponse(
                trafficLevel,
                slotName,
                idealNow,
                formattedLocalTime,
                formattedDay,
                zoneId.getId(),
                nextSlot,
                peakWindows
        );
    }

    private OptimalSlotStatusResponse.NextOptimalSlotDto calculateNextGoldenSlot(ZonedDateTime now) {
        LocalTime time = now.toLocalTime();
        LocalDate date = now.toLocalDate();
        LocalTime targetTime;
        String slotTitle;
        String cron;
        String reason;

        if (time.isBefore(LocalTime.of(7, 30))) {
            targetTime = LocalTime.of(7, 30);
            slotTitle = "🌅 Café antes de la Daily";
            cron = "0 30 7 ? * TUE,WED,THU *";
            reason = "Pico de la mañana para máxima visibilidad antes de programar.";
        } else if (time.isBefore(LocalTime.of(12, 30))) {
            targetTime = LocalTime.of(12, 30);
            slotTitle = "🍲 Almuerzo Tech";
            cron = "0 30 12 ? * TUE,WED,THU *";
            reason = "Pico de mediodía con lectura intensiva en dispositivos móviles.";
        } else if (time.isBefore(LocalTime.of(18, 0))) {
            targetTime = LocalTime.of(18, 0);
            slotTitle = "🌆 Fin de Jornada";
            cron = "0 0 18 ? * TUE,WED,THU *";
            reason = "Cierre de jornada ideal para generar debates y comentarios.";
        } else {
            // Siguiente día a las 07:30 AM
            date = date.plusDays(1);
            targetTime = LocalTime.of(7, 30);
            slotTitle = "🌅 Café antes de la Daily";
            cron = "0 30 7 ? * TUE,WED,THU *";
            reason = "Primer pico del día siguiente para alcanzar a los profesionales temprano.";
        }

        LocalDateTime estimated = LocalDateTime.of(date, targetTime);
        boolean isToday = date.equals(now.toLocalDate());
        String formattedTime = (isToday ? "Hoy" : "Mañana") + " a las " + targetTime.format(TIME_FORMATTER);

        return new OptimalSlotStatusResponse.NextOptimalSlotDto(
                slotTitle,
                estimated,
                formattedTime,
                cron,
                reason
        );
    }

    private boolean isTimeBetween(LocalTime current, LocalTime start, LocalTime end) {
        return !current.isBefore(start) && !current.isAfter(end);
    }

    private ZoneId resolveZoneId(Tenant tenant) {
        if (tenant != null && tenant.getTimezone() != null && !tenant.getTimezone().isBlank()) {
            try {
                return ZoneId.of(tenant.getTimezone().trim());
            } catch (Exception e) {
                log.warn("Timezone inválido '{}'. Usando America/Lima.", tenant.getTimezone());
            }
        }
        return ZoneId.of("America/Lima");
    }
}
