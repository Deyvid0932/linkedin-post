package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record ScheduleResponse(
    UUID id,
    String cronExpression,
    String description,
    Boolean isActive,
    LocalDateTime createdAt
) {}
