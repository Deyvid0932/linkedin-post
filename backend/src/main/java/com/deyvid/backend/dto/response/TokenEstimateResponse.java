package com.deyvid.backend.dto.response;

public record TokenEstimateResponse(
        int estimatedPromptTokens,
        int estimatedCompletionTokens,
        int totalEstimatedTokens,
        Double estimatedCostUsd,
        Integer remainingBalanceTokens,
        String modelName,
        String note
) {}
