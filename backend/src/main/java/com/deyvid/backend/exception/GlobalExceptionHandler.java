package com.deyvid.backend.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(AiNotConfiguredException.class)
    public ResponseEntity<com.deyvid.backend.dto.response.ErrorResponse> handleAiNotConfigured(AiNotConfiguredException ex) {
        log.warn("IA no configurada: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FAILED_DEPENDENCY) // 424
                .body(new com.deyvid.backend.dto.response.ErrorResponse(ex.getErrorCode(), ex.getMessage()));
    }

    @ExceptionHandler(AiServiceException.class)
    public ResponseEntity<com.deyvid.backend.dto.response.ErrorResponse> handleAiService(AiServiceException ex) {
        log.error("Fallo de servicio IA [{}]: {}", ex.getErrorCode(), ex.getMessage());
        HttpStatus status = switch (ex.getErrorCode()) {
            case "AI_NOT_CONFIGURED" -> HttpStatus.FAILED_DEPENDENCY;  // 424
            case "AI_RATE_LIMIT" -> HttpStatus.TOO_MANY_REQUESTS;      // 429
            case "AI_TIMEOUT" -> HttpStatus.GATEWAY_TIMEOUT;           // 504
            default -> HttpStatus.BAD_GATEWAY;                         // 502 - AI_GENERATION_FAILED
        };
        return ResponseEntity.status(status)
                .body(new com.deyvid.backend.dto.response.ErrorResponse(ex.getErrorCode(), ex.getMessage()));
    }

    @ExceptionHandler(TokenExpiredException.class)
    public ResponseEntity<Map<String, Object>> handleTokenExpiredException(TokenExpiredException ex) {
        log.warn("Token expired exception: {}", ex.getMessage());
        Map<String, Object> body = createErrorBody(HttpStatus.FAILED_DEPENDENCY, "El token de LinkedIn ha expirado. Reconecta la cuenta en Conexiones.");
        return ResponseEntity.status(HttpStatus.FAILED_DEPENDENCY).body(body);
    }

    @ExceptionHandler(PipelineExecutionException.class)
    public ResponseEntity<Map<String, Object>> handlePipelineExecutionException(PipelineExecutionException ex) {
        log.error("Pipeline execution exception: ", ex);
        Map<String, Object> body = createErrorBody(HttpStatus.BAD_GATEWAY, "No se pudo completar la publicación. Revisa el historial y la conexión con LinkedIn antes de reintentar.");
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(body);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentialsException(BadCredentialsException ex) {
        log.warn("Bad credentials attempt: {}", ex.getMessage());
        Map<String, Object> body = createErrorBody(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDeniedException(AccessDeniedException ex) {
        log.warn("Access denied exception: {}", ex.getMessage());
        Map<String, Object> body = createErrorBody(HttpStatus.FORBIDDEN, "Acceso denegado: permisos insuficientes");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(IllegalArgumentException ex) {
        log.warn("Illegal argument exception: {}", ex.getMessage());
        Map<String, Object> body = createErrorBody(HttpStatus.BAD_REQUEST, ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, Object> body = createErrorBody(HttpStatus.BAD_REQUEST, "Error de validación en los datos enviados");
        Map<String, String> errors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
        }
        body.put("errors", errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatusException(ResponseStatusException ex) {
        int status = ex.getStatusCode().value();
        HttpStatus resolved = HttpStatus.resolve(status);
        if (resolved == null || status < 400 || status >= 500) resolved = HttpStatus.INTERNAL_SERVER_ERROR;
        String message = ex.getReason() == null ? "No se pudo completar la solicitud." : ex.getReason();
        return ResponseEntity.status(resolved).body(createErrorBody(resolved, message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneralException(Exception ex) {
        log.error("Unhandled internal server exception: ", ex);
        Map<String, Object> body = createErrorBody(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde."
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private Map<String, Object> createErrorBody(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return body;
    }
}
