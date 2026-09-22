package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record PromptTestRequest(
        @NotBlank(message = "El prompt a probar no puede estar vacío")
        String testPrompt,
        String sampleTopic,
        String approach
) {}
