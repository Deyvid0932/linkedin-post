package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LinkedInTokenRequest(
        @NotBlank(message = "El access token de LinkedIn es obligatorio")
        String accessToken,

        String personUrn,

        Integer expiresInDays
) {}
