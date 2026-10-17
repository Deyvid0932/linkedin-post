package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record QueueScheduleRequest(
        @NotBlank String publishAt,
        @NotBlank String timezone,
        @NotBlank String expectedRevision) {}
