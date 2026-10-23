package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SaveContentVariantRequest(
        @NotNull ContentAdaptRequest.Channel channel,
        @NotBlank @Size(max = 3000) String text
) {}
