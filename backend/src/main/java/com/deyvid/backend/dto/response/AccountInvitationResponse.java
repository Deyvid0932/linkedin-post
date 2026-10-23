package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record AccountInvitationResponse(
        UUID id,
        String email,
        LocalDateTime createdAt,
        LocalDateTime expiresAt,
        LocalDateTime acceptedAt,
        LocalDateTime revokedAt,
        String status
) {}
