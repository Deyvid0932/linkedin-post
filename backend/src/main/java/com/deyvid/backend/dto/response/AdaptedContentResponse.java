package com.deyvid.backend.dto.response;

public record AdaptedContentResponse(
        String channel,
        String text,
        int characterCount,
        int recommendedCharacters,
        boolean publishingAvailable
) {}
