package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Future;
import java.time.Instant;

/** A null limit removes the account override and restores inheritance. */
public record UserAiQuotaRequest(
        @Min(1) @Max(120) Integer requestsPerMinute,
        @Future Instant expiresAt
) {}
