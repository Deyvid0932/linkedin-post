package com.deyvid.backend.dto.response;

import com.deyvid.backend.entity.enums.SourceMode;

public record GeneratedPreviewResponse(
    SourceMode sourceMode,
    String generatedText,
    String imageUrl,
    String sourceReference
) {}
