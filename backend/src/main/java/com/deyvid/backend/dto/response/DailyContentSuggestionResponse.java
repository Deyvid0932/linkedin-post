package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;

public record DailyContentSuggestionResponse(
        String title,
        String text,
        String rationale,
        long basedOnPublications,
        String bestObservedDay,
        String bestObservedHour,
        LocalDateTime generatedAt
) {}
