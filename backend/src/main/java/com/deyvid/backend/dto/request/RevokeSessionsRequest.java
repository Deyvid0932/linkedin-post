package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record RevokeSessionsRequest(
        @NotBlank(message = "Escribe tu contraseña actual para cerrar las sesiones")
        String currentPassword) {
}
