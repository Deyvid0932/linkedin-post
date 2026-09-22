package com.deyvid.backend.dto.request;

import com.deyvid.backend.entity.enums.LinkedInAccountType;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SaveLinkedInAccountRequest(
        String accessToken,
        UUID useExistingTokenFromAccountId,
        @NotNull LinkedInAccountType accountType,
        String authorUrn,
        String displayName,
        String vanityName,
        Integer expiresInDays,
        Integer maxPostsPerDay,
        Boolean isEnabled,
        Boolean isPrimary
) {}
