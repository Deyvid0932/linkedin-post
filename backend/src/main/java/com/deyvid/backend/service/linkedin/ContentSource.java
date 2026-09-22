package com.deyvid.backend.service.linkedin;

import com.deyvid.backend.entity.enums.SourceMode;

public record ContentSource(
    SourceMode mode,
    String title,
    String rawContent,
    String codeSnippet,
    String referenceUrl
) {}
