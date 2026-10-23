package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import com.deyvid.backend.validation.SupportedNanoGptImageModel;

public record TenantProfileRequest(
    String systemPrompt,
    
    String timezone,
    @Pattern(regexp = "REQUIRE_APPROVAL|AUTOMATIC", message = "Modo de aprobación inválido") String appApprovalMode,
    @Min(100) @Max(3000) Integer appTargetCharacters,
    @SupportedNanoGptImageModel String appImageModel,
    @Pattern(regexp = "deepseek-flash|deepseek-v4-pro", message = "Modelo de texto no disponible") String appTextModel
) {}
