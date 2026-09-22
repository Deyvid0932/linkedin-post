package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

public record UserProfileResponse(
    UUID id,
    UUID tenantId,
    String name,
    String email,
    String pictureUrl,
    Boolean isActive,
    Set<String> roles,
    LocalDateTime createdAt
) {}
