package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyCodeRequest(
        @NotBlank(message = "El correo electrónico es obligatorio")
        @Email(message = "El formato de correo no es válido")
        String email,

        @NotBlank(message = "El código OTP es obligatorio")
        @Size(min = 6, max = 6, message = "El código debe tener exactamente 6 dígitos")
        String code
) {}
