package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotNull;

public record WebhookActiveRequest(@NotNull Boolean active) {}
