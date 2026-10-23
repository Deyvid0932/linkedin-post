package com.deyvid.backend.dto.response;

import java.util.Map;

public record PostingDistributionResponse(
        Map<Integer, Long> postsByHour,          // { 7: 5, 8: 12, 13: 8, 19: 15 }
        Map<String, Long> postsByDayOfWeek,      // { "MONDAY": 4, "TUESDAY": 10, "WEDNESDAY": 14, ... }
        Map<String, Long> postsBySource,
        long totalPublishedPosts,
        String bestObservedHour,                 // ej. "08:00 AM"
        String bestObservedDay,                  // ej. "MIÉRCOLES"
        long successfulPostsCount,
        long publicationsWithPublishedAtCount,
        long failedPostsCount,
        Double successRatePercentage,
        long recordedTokens,
        Map<String, Long> tokensByModel,
        long inputTokens,
        long outputTokens,
        long usageEvents,
        Map<String, Long> tokensByDay
) {}
