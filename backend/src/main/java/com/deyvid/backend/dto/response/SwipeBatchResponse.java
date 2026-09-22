package com.deyvid.backend.dto.response;

import java.util.List;

public record SwipeBatchResponse(
    String sourceMode,
    String topicTitle,
    String referenceUrl,
    List<SwipeVersionDto> versions
) {
    public record SwipeVersionDto(
        String id,
        String estructuraUsada, // EXPERT, STORYTELLER, PROVOCATIVE
        String tituloEstructura,
        String textoGenerado,
        String imageUrl,
        int tokensUsed,
        double costUsd,
        double percentMonthlyCredit
    ) {}
}
