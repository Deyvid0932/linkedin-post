package com.deyvid.backend.service.ai;

import java.util.Set;

/** Supported DeepSeek chat model IDs exposed in the workspace settings. */
public final class DeepSeekTextModels {
    public static final String DEFAULT_MODEL = "deepseek-flash";
    private static final Set<String> SUPPORTED = Set.of(DEFAULT_MODEL, "deepseek-v4-pro");

    private DeepSeekTextModels() {}

    public static boolean isSupported(String model) {
        return model != null && SUPPORTED.contains(model);
    }

    public static String requireSupported(String model) {
        if (!isSupported(model)) throw new IllegalArgumentException("Modelo de texto no disponible");
        return model;
    }

    public static String normalize(String model) {
        if (model == null || model.isBlank() || model.equals("deepseek-chat") || model.equals("deepseek-reasoner")) {
            return DEFAULT_MODEL;
        }
        return isSupported(model) ? model : DEFAULT_MODEL;
    }
}
