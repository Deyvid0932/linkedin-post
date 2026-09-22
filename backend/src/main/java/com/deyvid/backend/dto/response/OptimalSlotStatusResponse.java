package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record OptimalSlotStatusResponse(
        String currentTrafficLevel,     // "GOLDEN", "MODERATE", "OFF_PEAK"
        String currentSlotName,          // ej. "🌅 Café antes de la Daily (Pico #1)"
        boolean isIdealToPublishNow,
        String currentLocalTime,         // ej. "08:15 AM"
        String currentDayOfWeek,         // ej. "MIÉRCOLES"
        String tenantTimezone,           // ej. "America/Lima"
        NextOptimalSlotDto nextSlot,
        List<PeakWindowDto> peakWindows
) {
    public record NextOptimalSlotDto(
            String name,
            LocalDateTime estimatedTime,
            String formattedTime,
            String suggestedCron,
            String reason
    ) {}

    public record PeakWindowDto(
            String title,
            String timeRange,
            String targetAudienceAction,
            String rating,
            boolean isCurrent
    ) {}
}
