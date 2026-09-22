package com.deyvid.backend.dto.response;

import java.util.List;

public record OnboardingStatusResponse(
        boolean hasLinkedInConnection,
        boolean hasSourcesConfigured,
        boolean hasActiveSchedules,
        boolean hasCustomPrompt,
        int completedSteps,
        int totalSteps,
        int progressPercentage,
        List<OnboardingStep> steps
) {
    public record OnboardingStep(
            String key,
            String label,
            String description,
            boolean isCompleted
    ) {}
}
