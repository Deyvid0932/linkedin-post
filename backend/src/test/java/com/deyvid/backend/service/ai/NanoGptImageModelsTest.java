package com.deyvid.backend.service.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.math.BigDecimal;
import java.util.Comparator;

class NanoGptImageModelsTest {
    @Test
    void onlyCuratedNanoGptImageModelsAreAcceptedAndLegacyFluxFallsBackSafely() {
        assertTrue(NanoGptImageModels.isSupported("google/gemini-nano-banana-2.1"));
        assertTrue(NanoGptImageModels.isSupported("qwen-image-2.1/text-to-image"));
        assertTrue(NanoGptImageModels.isSupported("qwen-image-3"));
        assertTrue(NanoGptImageModels.isSupported("nano-banana-2-lite"));
        assertTrue(NanoGptImageModels.isSupported("ideogram/v4/instant"));
        assertTrue(NanoGptImageModels.isSupported("gpt-image-2"));
        assertFalse(NanoGptImageModels.isSupported("https://attacker.example/model"));
        assertEquals(NanoGptImageModels.DEFAULT_MODEL, NanoGptImageModels.normalize("flux-dev"));
        assertEquals(NanoGptImageModels.DEFAULT_MODEL, NanoGptImageModels.normalize("unknown-model"));
    }

    @Test
    void catalogIsTheSupportedAllowlistAndIsSortedByApproximatePrice() {
        var catalog = NanoGptImageModels.catalog();
        var sorted = catalog.stream()
                .sorted(Comparator.comparing(NanoGptImageModels.Option::estimatedPriceUsd))
                .toList();

        assertEquals(sorted, catalog);
        assertEquals(catalog.size(), catalog.stream().map(NanoGptImageModels.Option::id).distinct().count());
        assertTrue(catalog.stream().allMatch(option -> NanoGptImageModels.isSupported(option.id())));
        assertEquals(new BigDecimal("0.004"), catalog.get(0).estimatedPriceUsd());
        assertEquals(new BigDecimal("0.167"), catalog.get(catalog.size() - 1).estimatedPriceUsd());
    }
}
