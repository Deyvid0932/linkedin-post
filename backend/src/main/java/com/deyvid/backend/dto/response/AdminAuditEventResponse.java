package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminAuditEventResponse(
        UUID id,
        UUID tenantId,
        String actor,
        String action,
        LocalDateTime createdAt
) {}
