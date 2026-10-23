package com.deyvid.backend.dto.response;

public record WebhookCreatedResponse(WebhookEndpointResponse endpoint, String secret) {}
