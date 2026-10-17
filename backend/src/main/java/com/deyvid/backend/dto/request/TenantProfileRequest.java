package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

public record TenantProfileRequest(
    String systemPrompt,
    
    String timezone,
    @Pattern(regexp = "REQUIRE_APPROVAL|AUTOMATIC", message = "Modo de aprobación inválido") String appApprovalMode,
    @Min(100) @Max(3000) Integer appTargetCharacters,
    @Pattern(regexp = "recraft-ai/recraft-v4\\.1-flash/text-to-image|qwen-image-2\\.1/text-to-image|bytedance/seedream-v5\\.0-flash|seedream-v4|nano-banana|nano-banana-2-fast|black-forest-labs/flux-3/text-to-image|google/gemini-nano-banana-2\\.1|ideogram/v4\\.5|gpt-image-2|qwen-image-2\\.1-pro|nano-banana-pro|gpt-image-1\\.5", message = "Modelo de imagen no disponible") String appImageModel
) {}
