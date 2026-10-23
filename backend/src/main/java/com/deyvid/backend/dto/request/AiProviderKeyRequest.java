package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiProviderKeyRequest(
        @NotBlank(message = "La clave API es obligatoria")
        @Size(min = 8, max = 512, message = "La clave debe tener entre 8 y 512 caracteres")
        String apiKey
) {}
