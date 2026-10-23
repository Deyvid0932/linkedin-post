package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AppearancePolicyRequest(
        @NotBlank
        @Pattern(regexp = "red|blue|green|yellow")
        String defaultAccentColor,
        @NotEmpty
        @Size(max = 4)
        List<@Pattern(regexp = "red|blue|green|yellow") String> allowedAccentColors
) {}
