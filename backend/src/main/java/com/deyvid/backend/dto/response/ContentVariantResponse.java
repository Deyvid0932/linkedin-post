package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record ContentVariantResponse(
        UUID id,
        String channel,
        String text,
        int characterCount,
        int recommendedCharacters,
        LocalDateTime updatedAt
) {}
