package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record PromptVersionResponse(
        UUID id,
        Integer versionNumber,
        String promptText,
        String changeNotes,
        String createdBy,
        LocalDateTime createdAt
) {}
