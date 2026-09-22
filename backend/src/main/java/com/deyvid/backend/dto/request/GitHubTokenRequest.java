package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record GitHubTokenRequest(
    @NotBlank(message = "El Personal Access Token es obligatorio")
    String personalAccessToken,

    @NotBlank(message = "El usuario de GitHub es obligatorio")
    String githubUsername
) {}
