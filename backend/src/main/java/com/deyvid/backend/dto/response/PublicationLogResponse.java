package com.deyvid.backend.dto.response;

import com.deyvid.backend.entity.enums.LinkedInAccountType;
import com.deyvid.backend.entity.enums.PublicationStatus;
import com.deyvid.backend.entity.enums.SourceMode;

import java.time.LocalDateTime;
import java.util.UUID;

public record PublicationLogResponse(
    UUID id,
    SourceMode sourceMode,
    PublicationStatus status,
    LinkedInAccountType accountType,
    String authorUrn,
    String generatedText,
    String imageUrl,
    String linkedinPostUrn,
    String sourceReference,
    String errorMessage,
    Long executionTimeMs,
    String llmModelUsed,
    Integer llmTokensUsed,
    LocalDateTime publishedAt,
    LocalDateTime createdAt
) {}
