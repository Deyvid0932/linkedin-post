package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record TenantProfileRequest(
    String systemPrompt,
    
    @NotBlank(message = "La zona horaria es obligatoria")
    String timezone
) {}
