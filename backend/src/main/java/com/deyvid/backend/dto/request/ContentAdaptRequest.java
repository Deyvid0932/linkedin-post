package com.deyvid.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ContentAdaptRequest(
        @NotNull @Valid ComposeRequest content,
        @NotNull Channel channel
) {
    public enum Channel {
        X("X", 280, "Redacta una publicación breve y clara para X. Conserva una sola idea, evita introducir hechos nuevos y respeta el máximo de caracteres de AutoPost."),
        YOUTUBE_SHORTS("YouTube Shorts", 1500, "Escribe un guion vertical breve para YouTube Shorts, con un gancho, desarrollo oral sencillo y cierre. No inventes imágenes, cifras ni experiencias."),
        TIKTOK("TikTok", 1500, "Escribe un gancho y un texto breve para acompañar un video de TikTok. Usa lenguaje natural, una sola idea y hasta cuatro etiquetas pertinentes; no afirmes que un audio o tendencia está en auge.");

        private final String label;
        private final int recommendedCharacters;
        private final String instructions;

        Channel(String label, int recommendedCharacters, String instructions) {
            this.label = label;
            this.recommendedCharacters = recommendedCharacters;
            this.instructions = instructions;
        }

        public String label() { return label; }
        public int recommendedCharacters() { return recommendedCharacters; }
        public String instructions() { return instructions; }
    }
}
