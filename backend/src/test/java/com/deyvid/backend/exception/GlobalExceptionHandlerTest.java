package com.deyvid.backend.exception;

import com.deyvid.backend.dto.response.ErrorResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
    }

    @Test
    void testHandleAiNotConfiguredReturns424() {
        AiNotConfiguredException ex = new AiNotConfiguredException("Configura tu API Key en Ajustes");
        ResponseEntity<ErrorResponse> response = handler.handleAiNotConfigured(ex);

        assertEquals(HttpStatus.FAILED_DEPENDENCY, response.getStatusCode());
        assertEquals(424, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("AI_NOT_CONFIGURED", response.getBody().errorCode());
        assertEquals("Configura tu API Key en Ajustes", response.getBody().message());
    }

    @Test
    void testHandleAiRateLimitReturns429() {
        AiServiceException ex = new AiServiceException("AI_RATE_LIMIT", "Demasiadas peticiones a DeepSeek");
        ResponseEntity<ErrorResponse> response = handler.handleAiService(ex);

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals(429, response.getStatusCode().value());
        assertEquals("AI_RATE_LIMIT", response.getBody().errorCode());
    }

    @Test
    void testHandleAiTimeoutReturns504() {
        AiServiceException ex = new AiServiceException("AI_TIMEOUT", "DeepSeek tardo demasiado");
        ResponseEntity<ErrorResponse> response = handler.handleAiService(ex);

        assertEquals(HttpStatus.GATEWAY_TIMEOUT, response.getStatusCode());
        assertEquals(504, response.getStatusCode().value());
        assertEquals("AI_TIMEOUT", response.getBody().errorCode());
    }

    @Test
    void testHandleAiGenericErrorReturns502() {
        AiServiceException ex = new AiServiceException("AI_GENERATION_FAILED", "Error de red con DeepSeek");
        ResponseEntity<ErrorResponse> response = handler.handleAiService(ex);

        assertEquals(HttpStatus.BAD_GATEWAY, response.getStatusCode());
        assertEquals(502, response.getStatusCode().value());
        assertEquals("AI_GENERATION_FAILED", response.getBody().errorCode());
    }
}