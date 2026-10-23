package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TopicExploreRequest(
        @NotBlank(message = "Indica un nicho o área para explorar")
        @Size(max = 160, message = "El nicho no puede superar 160 caracteres")
        String niche
) {}
