package com.deyvid.backend.repository;

import java.util.UUID;
import java.time.Instant;

public interface TenantAiQuotaProjection {
    UUID getTenantId();
    String getPrimaryEmail();
    Long getAccountCount();
    Integer getOverrideRequestsPerMinute();
    Instant getOverrideExpiresAt();
}
