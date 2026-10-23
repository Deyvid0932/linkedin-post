package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record WebhookDeliveryResponse(
        UUID id,
        UUID endpointId,
        String endpointName,
        UUID eventId,
        String eventType,
        String status,
        int attemptCount,
        Integer httpStatus,
        String responseSummary,
        LocalDateTime createdAt,
        LocalDateTime deliveredAt
) {}
