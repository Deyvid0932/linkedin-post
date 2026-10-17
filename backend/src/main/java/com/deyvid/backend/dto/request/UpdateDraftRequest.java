package com.deyvid.backend.dto.request;

public record UpdateDraftRequest(
    @jakarta.validation.constraints.Size(max = 3000) String generatedText,
    @jakarta.validation.constraints.Size(max = 6990600) String imageUrl
) {}
