package com.deyvid.backend.dto.response;

import java.time.LocalDate;

public record AdminDailyImageGenerationResponse(
        LocalDate date,
        boolean tracked,
        long successfulGenerations
) {}
