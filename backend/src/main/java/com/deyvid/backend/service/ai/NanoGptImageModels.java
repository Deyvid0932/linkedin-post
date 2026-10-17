package com.deyvid.backend.service.ai;

import java.util.Set;

/** Curated NanoGPT image-generation models accepted by the application settings. */
public final class NanoGptImageModels {
    public static final String DEFAULT_MODEL = "qwen-image-2.1/text-to-image";
    private static final Set<String> SUPPORTED = Set.of(
            "recraft-ai/recraft-v4.1-flash/text-to-image",
            DEFAULT_MODEL,
            "bytedance/seedream-v5.0-flash",
            "seedream-v4",
            "nano-banana",
            "nano-banana-2-fast",
            "black-forest-labs/flux-3/text-to-image",
            "google/gemini-nano-banana-2.1",
            "ideogram/v4.5",
            "gpt-image-2",
            "qwen-image-2.1-pro",
            "nano-banana-pro",
            "gpt-image-1.5"
    );

    private NanoGptImageModels() {}

    public static boolean isSupported(String model) {
        return model != null && SUPPORTED.contains(model);
    }

    public static String normalize(String model) {
        if (model == null || model.isBlank() || model.equals("flux-schnell") || model.equals("flux-dev")) {
            return DEFAULT_MODEL;
        }
        return SUPPORTED.contains(model) ? model : DEFAULT_MODEL;
    }
}
