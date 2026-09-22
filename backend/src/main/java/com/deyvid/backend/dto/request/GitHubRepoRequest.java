package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record GitHubRepoRequest(
    @NotBlank(message = "El propietario del repositorio es obligatorio")
    String repoOwner,

    @NotBlank(message = "El nombre del repositorio es obligatorio")
    String repoName
) {}
