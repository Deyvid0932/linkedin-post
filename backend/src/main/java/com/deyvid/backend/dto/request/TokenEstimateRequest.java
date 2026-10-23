package com.deyvid.backend.dto.request;

public record TokenEstimateRequest(
        String text,
        String prompt,
        String topic,
        Integer batchCount,
        Integer targetCharacters
) {}
