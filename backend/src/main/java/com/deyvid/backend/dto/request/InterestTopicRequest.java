package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

public record InterestTopicRequest(
    @NotBlank(message = "El nombre del tema de interés es obligatorio")
    String topicName
) {}
