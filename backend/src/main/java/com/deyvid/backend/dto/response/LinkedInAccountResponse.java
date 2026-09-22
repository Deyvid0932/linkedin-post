package com.deyvid.backend.dto.response;

import com.deyvid.backend.entity.enums.LinkedInAccountType;

import java.time.LocalDateTime;
import java.util.UUID;

public record LinkedInAccountResponse(
        UUID id,
        LinkedInAccountType accountType,
        String authorUrn,
        String displayName,
        String vanityName,
        Integer maxPostsPerDay,
        Boolean isEnabled,
        Boolean isPrimary,
        Boolean isValid,
        LocalDateTime tokenExpiresAt,
        Long daysRemaining,
        String status, // "ACTIVE", "EXPIRING_SOON", "EXPIRED", "DISABLED"
        LocalDateTime createdAt
) {}
