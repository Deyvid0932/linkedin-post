package com.deyvid.backend.service.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NanoGptImageModelsTest {
    @Test
    void onlyCuratedNanoGptImageModelsAreAcceptedAndLegacyFluxFallsBackSafely() {
        assertTrue(NanoGptImageModels.isSupported("google/gemini-nano-banana-2.1"));
        assertTrue(NanoGptImageModels.isSupported("qwen-image-2.1/text-to-image"));
        assertTrue(NanoGptImageModels.isSupported("gpt-image-2"));
        assertFalse(NanoGptImageModels.isSupported("https://attacker.example/model"));
        assertEquals(NanoGptImageModels.DEFAULT_MODEL, NanoGptImageModels.normalize("flux-dev"));
        assertEquals(NanoGptImageModels.DEFAULT_MODEL, NanoGptImageModels.normalize("unknown-model"));
    }
}
