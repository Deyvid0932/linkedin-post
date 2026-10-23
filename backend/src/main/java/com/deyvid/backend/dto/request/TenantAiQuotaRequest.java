package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Future;
import java.time.Instant;

/** A null limit removes the override and restores the global policy. */
public record TenantAiQuotaRequest(
        @Min(1) @Max(120) Integer requestsPerMinute,
        @Future Instant expiresAt
) {}
