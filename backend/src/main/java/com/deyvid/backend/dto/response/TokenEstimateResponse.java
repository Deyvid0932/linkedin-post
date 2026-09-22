package com.deyvid.backend.dto.response;

public record TokenEstimateResponse(
        int estimatedPromptTokens,
        int estimatedCompletionTokens,
        int totalEstimatedTokens,
        double estimatedCostUsd,
        int remainingBalanceTokens,
        String modelName
) {}
