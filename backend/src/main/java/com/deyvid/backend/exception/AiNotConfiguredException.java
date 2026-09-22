package com.deyvid.backend.exception;

public class AiNotConfiguredException extends AiServiceException {
    public AiNotConfiguredException(String message) {
        super("AI_NOT_CONFIGURED", message);
    }
}
