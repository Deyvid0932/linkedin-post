package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        String userEmail,
        String action,
        String details,
        LocalDateTime createdAt
) {}
