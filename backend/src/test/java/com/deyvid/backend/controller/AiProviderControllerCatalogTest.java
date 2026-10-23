package com.deyvid.backend.controller;

import com.deyvid.backend.security.AuthHelper;
import com.deyvid.backend.service.TenantAiCredentialService;
import com.deyvid.backend.service.ai.NanoGptImageModels;
import org.junit.jupiter.api.Test;

import java.util.Comparator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class AiProviderControllerCatalogTest {
    @Test
    void returnsTheCuratedSafeCatalogInApproximatePriceOrder() {
        var controller = new AiProviderController(mock(AuthHelper.class), mock(TenantAiCredentialService.class));

        var response = controller.getImageModels();
        var catalog = response.getBody();

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(catalog);
        assertEquals(NanoGptImageModels.catalog().size(), catalog.size());
        assertEquals("ideogram/v4/instant", catalog.get(0).id());
        assertEquals("gpt-image-1.5", catalog.get(catalog.size() - 1).id());
        assertTrue(catalog.stream().allMatch(option -> option.name() != null && option.estimatedPriceUsd() != null));
        assertEquals(catalog.stream().sorted(Comparator.comparing(option -> option.estimatedPriceUsd())).toList(), catalog);
    }
}
