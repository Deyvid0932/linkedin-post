package com.deyvid.backend.validation;

import com.deyvid.backend.dto.request.TenantProfileRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupportedNanoGptImageModelValidatorTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void usesTheSupportedCatalogForPartialTenantUpdates() {
        var supported = request("google/gemini-nano-banana-2.1");
        var unsupported = request("https://attacker.example/model");
        var omitted = request(null);

        assertFalse(validator.validate(supported).stream()
                .anyMatch(error -> error.getPropertyPath().toString().equals("appImageModel")));
        assertTrue(validator.validate(unsupported).stream()
                .anyMatch(error -> error.getPropertyPath().toString().equals("appImageModel")));
        assertFalse(validator.validate(omitted).stream()
                .anyMatch(error -> error.getPropertyPath().toString().equals("appImageModel")));
    }

    private TenantProfileRequest request(String imageModel) {
        return new TenantProfileRequest(null, null, null, null, imageModel, null);
    }
}
