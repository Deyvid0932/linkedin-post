package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;

public record AiProviderStatusResponse(
        String provider,
        String label,
        boolean workspaceKeyConfigured,
        boolean serverFallbackConfigured,
        String effectiveSource,
        LocalDateTime updatedAt
) {}
