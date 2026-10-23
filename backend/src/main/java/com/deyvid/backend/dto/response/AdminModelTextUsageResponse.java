package com.deyvid.backend.dto.response;

public record AdminModelTextUsageResponse(
        String provider,
        String model,
        long requestCount,
        long inputTokens,
        long outputTokens,
        long totalTokens
) {}
