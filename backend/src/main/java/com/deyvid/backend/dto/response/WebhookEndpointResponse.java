package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record WebhookEndpointResponse(
        UUID id,
        String name,
        String targetHost,
        List<String> events,
        boolean active,
        boolean secretConfigured,
        LocalDateTime createdAt
) {}
