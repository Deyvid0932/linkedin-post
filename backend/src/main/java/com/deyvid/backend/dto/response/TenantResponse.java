package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record TenantResponse(
    UUID id,
    String systemPrompt,
    String timezone,
    Boolean isActive,
    Boolean isEmergencyPaused,
    Boolean isDryRun,
    LocalDateTime createdAt,
    String appApprovalMode,
    Integer appTargetCharacters,
    String appImageModel
) {}
