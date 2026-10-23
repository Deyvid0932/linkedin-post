package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record AdminUserResponse(
        UUID id,
        UUID tenantId,
        String name,
        String email,
        boolean active,
        Set<String> roles,
        LocalDateTime createdAt,
        Integer aiRequestsPerMinute,
        Instant aiRequestsPerMinuteExpiresAt,
        int effectiveAiRequestsPerMinute
) {}
