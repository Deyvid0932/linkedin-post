package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record BackupTopicRequest(
    @NotBlank(message = "El título o tema es obligatorio")
    String title,

    String description,
    String category,
    Integer priority,
    Boolean isAiResearch,
    Boolean isActive
) {}
