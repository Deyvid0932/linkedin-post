package com.deyvid.backend.service.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeepSeekTextModelsTest {
    @Test
    void acceptsOnlyTheModelsExposedInSettings() {
        assertTrue(DeepSeekTextModels.isSupported("deepseek-flash"));
        assertTrue(DeepSeekTextModels.isSupported("deepseek-v4-pro"));
        assertFalse(DeepSeekTextModels.isSupported("https://attacker.example/model"));
        assertThrows(IllegalArgumentException.class,
                () -> DeepSeekTextModels.requireSupported("unlisted-model"));
    }

    @Test
    void mapsRetiredAndUnknownDefaultsToTheCurrentEconomicalModel() {
        assertEquals("deepseek-flash", DeepSeekTextModels.normalize("deepseek-chat"));
        assertEquals("deepseek-flash", DeepSeekTextModels.normalize("deepseek-reasoner"));
        assertEquals("deepseek-flash", DeepSeekTextModels.normalize(null));
        assertEquals("deepseek-flash", DeepSeekTextModels.normalize("unknown-model"));
        assertEquals("deepseek-v4-pro", DeepSeekTextModels.normalize("deepseek-v4-pro"));
    }
}
