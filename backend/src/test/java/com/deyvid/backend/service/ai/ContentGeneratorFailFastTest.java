package com.deyvid.backend.service.ai;

import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.entity.enums.SourceMode;
import com.deyvid.backend.exception.AiNotConfiguredException;
import com.deyvid.backend.service.linkedin.ContentSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.reactive.function.client.WebClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;

class ContentGeneratorFailFastTest {

    private ContentGeneratorService contentGeneratorService;
    private ContentGeneratorService spyService;

    @BeforeEach
    void setUp() {
        WebClient webClient = mock(WebClient.class);
        contentGeneratorService = new ContentGeneratorService(webClient, null, null);
        spyService = Mockito.spy(contentGeneratorService);
    }

    @Test
    void testTruncateAtSentenceBoundaryWithinLimit() {
        String input = "Hola mundo. Esto es una prueba.";
        String result = ContentGeneratorService.truncateAtSentenceBoundary(input, 100);
        assertEquals(input, result);
    }

    @Test
    void testTruncateAtSentenceBoundaryCutsAtSentence() {
        String sentence1 = "Primera oracion completa que aporta mucho valor profesional al lector de LinkedIn. ";
        String sentence2 = "Segunda oracion que es demasiado larga y sobrepasa con creces el limite maximo permitido en el modo micro.";
        String input = sentence1 + sentence2;

        String result = ContentGeneratorService.truncateAtSentenceBoundary(input, 110);
        assertTrue(result.length() <= 110);
        assertEquals(sentence1.trim(), result);
    }

    @Test
    void testGenerateThrowsWhenNoApiKey() {
        doReturn(false).when(spyService).isApiKeyConfigured();

        ContentSource source = new ContentSource(SourceMode.RESEARCH, "Tema de prueba", "Detalles", null, null);
        Tenant tenant = new Tenant();

        AiNotConfiguredException ex = assertThrows(AiNotConfiguredException.class, () ->
                spyService.generateVersionWithApproach(tenant, source, "COMPARATIVE_B2B", "MICRO")
        );
        assertEquals("AI_NOT_CONFIGURED", ex.getErrorCode());
        assertTrue(ex.getMessage().contains("Configura tu API Key en Ajustes"));
    }

    @Test
    void testGenerateThrowsWhenSourceIsBlank() {
        doReturn(true).when(spyService).isApiKeyConfigured();

        ContentSource emptySource = new ContentSource(SourceMode.RESEARCH, "", "", null, null);
        Tenant tenant = new Tenant();

        AiNotConfiguredException ex = assertThrows(AiNotConfiguredException.class, () ->
                spyService.generateVersionWithApproach(tenant, emptySource, "COMPARATIVE_B2B", "MICRO")
        );
        assertEquals("AI_NOT_CONFIGURED", ex.getErrorCode());
        assertTrue(ex.getMessage().contains("No hay tema ni prompt"));
    }
}