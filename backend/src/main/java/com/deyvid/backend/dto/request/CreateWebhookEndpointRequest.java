package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateWebhookEndpointRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 2048) String targetUrl,
        @NotEmpty @Size(max = 3) List<@NotBlank String> events
) {}
