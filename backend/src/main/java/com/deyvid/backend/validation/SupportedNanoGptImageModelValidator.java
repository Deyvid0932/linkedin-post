package com.deyvid.backend.validation;

import com.deyvid.backend.service.ai.NanoGptImageModels;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class SupportedNanoGptImageModelValidator
        implements ConstraintValidator<SupportedNanoGptImageModel, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || NanoGptImageModels.isSupported(value);
    }
}
