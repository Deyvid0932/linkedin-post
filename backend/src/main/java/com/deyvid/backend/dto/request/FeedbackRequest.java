package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record FeedbackRequest(
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 3000) String textoGenerado,
    String tema,
    @NotNull @jakarta.validation.constraints.Min(-1) @jakarta.validation.constraints.Max(1) Integer puntajeUsuario,
    String estructuraUsada,
    String sourceMode,
    Integer tokensUsed,
    Double costUsd,
    String imageUrl,
    UUID targetCredentialId,
    String targetAccountType
) {}
