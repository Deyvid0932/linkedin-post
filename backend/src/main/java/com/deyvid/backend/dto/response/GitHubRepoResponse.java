package com.deyvid.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record GitHubRepoResponse(
    UUID id,
    String repoOwner,
    String repoName,
    LocalDateTime lastCheckedAt,
    String lastCommitSha,
    Boolean isActive,
    LocalDateTime createdAt
) {}
