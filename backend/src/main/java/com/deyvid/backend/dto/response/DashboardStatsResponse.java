package com.deyvid.backend.dto.response;

public record DashboardStatsResponse(
    long totalPublications,
    long successCount,
    long failedCount,
    long activeSchedules,
    boolean linkedInConnected,
    long linkedInDaysRemaining
) {}
