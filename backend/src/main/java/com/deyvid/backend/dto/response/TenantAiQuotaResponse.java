package com.deyvid.backend.dto.response;

import java.util.UUID;
import java.time.Instant;

public record TenantAiQuotaResponse(
        UUID tenantId,
        String primaryEmail,
        long accountCount,
        Integer overrideRequestsPerMinute,
        Instant overrideExpiresAt,
        int effectiveRequestsPerMinute
) {}
