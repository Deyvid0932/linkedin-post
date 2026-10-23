package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UserAppearanceRequest(
        @NotBlank
        @Pattern(regexp = "red|blue|green|yellow")
        String accentColor
) {}
