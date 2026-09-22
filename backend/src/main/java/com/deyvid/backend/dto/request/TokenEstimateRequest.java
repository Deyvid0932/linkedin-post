package com.deyvid.backend.dto.request;

public record TokenEstimateRequest(
        String prompt,
        String topic,
        Integer batchCount
) {}
