package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.*;
import java.util.UUID;

public record ComposeRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 3000) String text,
        @NotNull Tone tone,
        @NotBlank @Size(max = 200) String audience,
        @NotNull Goal goal,
        @Size(max = 1500) String instructions,
        @Size(max = 6990600) String imageUrl,
        UUID targetCredentialId) {
    public enum Tone { PROFESSIONAL, TECHNICAL, PERSONAL, CONVERSATIONAL }
    public enum Goal { TEACH, DISCUSS, SHOW_PROJECT, SHARE_LEARNING }
}
