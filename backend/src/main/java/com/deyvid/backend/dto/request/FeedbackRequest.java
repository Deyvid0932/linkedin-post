package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record FeedbackRequest(
    @NotNull String textoGenerado,
    String tema,
    @NotNull Integer puntajeUsuario,
    String estructuraUsada,
    String sourceMode,
    Integer tokensUsed,
    Double costUsd,
    String imageUrl,
    UUID targetCredentialId,
    String targetAccountType
) {}
