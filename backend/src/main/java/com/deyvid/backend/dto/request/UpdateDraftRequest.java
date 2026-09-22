package com.deyvid.backend.dto.request;

public record UpdateDraftRequest(
    String generatedText,
    String imageUrl
) {}
