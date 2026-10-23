package com.deyvid.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TopicExplorationServiceTest {
    @Test
    void parsesDistinctEditorialIdeasAndRemovesListMarkers() {
        String response = """
                1. Diseño de APIs idempotentes para evitar operaciones duplicadas
                - Estrategias de caché HTTP para reducir latencia en servicios Java
                • Diseño de APIs idempotentes para evitar operaciones duplicadas
                4) Límites de concurrencia y control de presión en Spring Boot
                """;

        assertEquals(List.of(
                "Diseño de APIs idempotentes para evitar operaciones duplicadas",
                "Estrategias de caché HTTP para reducir latencia en servicios Java",
                "Límites de concurrencia y control de presión en Spring Boot"),
                TopicExplorationService.parseIdeas(response));
    }

    @Test
    void ignoresEmptyAndUnreasonablyLongLines() {
        String response = "Una idea concreta y suficientemente larga\n\n" + "x".repeat(161);

        assertEquals(List.of("Una idea concreta y suficientemente larga"),
                TopicExplorationService.parseIdeas(response));
    }
}
