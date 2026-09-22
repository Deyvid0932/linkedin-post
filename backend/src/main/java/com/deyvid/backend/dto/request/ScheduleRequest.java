package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ScheduleRequest(
    @NotBlank(message = "La expresión cron es obligatoria")
    String cronExpression,

    String description
) {}
