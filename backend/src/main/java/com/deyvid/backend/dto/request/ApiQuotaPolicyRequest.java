package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ApiQuotaPolicyRequest(
        @NotNull @Min(1) @Max(120) Integer authRequestsPerMinute,
        @NotNull @Min(1) @Max(120) Integer aiRequestsPerMinute,
        @NotNull @Min(1) @Max(600) Integer apiRequestsPerMinute
) {}
