package com.deyvid.backend.dto.response;

public record ErrorResponse(
        String errorCode,
        String message
) {}
