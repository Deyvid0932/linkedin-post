package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AcceptAccountInvitationRequest(
        @NotBlank(message = "El enlace de invitación no es válido")
        @Size(min = 40, max = 64, message = "El enlace de invitación no es válido")
        @Pattern(regexp = "[A-Za-z0-9_-]+", message = "El enlace de invitación no es válido")
        String token,

        @NotBlank(message = "El nombre es obligatorio")
        @Size(min = 2, max = 100, message = "El nombre debe tener entre 2 y 100 caracteres")
        String name,

        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 8, max = 128, message = "La contraseña debe tener entre 8 y 128 caracteres")
        String password
) {}
