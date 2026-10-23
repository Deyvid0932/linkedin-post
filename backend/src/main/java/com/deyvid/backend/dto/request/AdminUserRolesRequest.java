package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.Set;

public record AdminUserRolesRequest(
        @NotEmpty(message = "La cuenta debe conservar al menos un rol")
        Set<@NotBlank @Pattern(regexp = "ROLE_ADMIN|ROLE_DESARROLLADOR|ROLE_USER",
                message = "El rol solicitado no está permitido") String> roles
) {}
