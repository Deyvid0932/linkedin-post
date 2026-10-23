package com.deyvid.backend.service.ai;

import java.util.Set;
import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/** Curated NanoGPT image-generation models accepted by the application settings. */
public final class NanoGptImageModels {
    public static final String DEFAULT_MODEL = "qwen-image-2.1/text-to-image";
    private static final List<Option> CATALOG = List.of(
            new Option("ideogram/v4/instant", "Ideogram V4 Instant · económico y rápido", new BigDecimal("0.004")),
            new Option("recraft-ai/recraft-v4.1-flash/text-to-image", "Recraft V4.1 Flash · diseños e ilustraciones", new BigDecimal("0.008")),
            new Option("blackforestlabs/flux-3/klein/text-to-image", "FLUX.3 Klein · rápido y económico", new BigDecimal("0.009")),
            new Option(DEFAULT_MODEL, "Qwen Image 2.1 · buen texto y relación calidad/precio", new BigDecimal("0.020")),
            new Option("bytedance/seedream-v5.0-flash", "Seedream 5.0 Flash · rápido", new BigDecimal("0.027")),
            new Option("qwen-image-3", "Qwen Image 3 · nueva generación", new BigDecimal("0.030")),
            new Option("seedream-v4", "Seedream 4.0 · composición y detalle", new BigDecimal("0.030")),
            new Option("nano-banana", "Nano Banana · generación y edición", new BigDecimal("0.039")),
            new Option("nano-banana-2-lite", "Nano Banana 2 Lite · rápido", new BigDecimal("0.040")),
            new Option("qwen-image-3-pro", "Qwen Image 3 Pro · alta calidad", new BigDecimal("0.040")),
            new Option("nano-banana-2-fast", "Nano Banana 2 Fast · 2K rápido", new BigDecimal("0.045")),
            new Option("black-forest-labs/flux-3/text-to-image", "FLUX.3 Image · fotografía e ilustración", new BigDecimal("0.050")),
            new Option("ideogram/v4.5", "Ideogram V4.5 · texto dentro de imágenes", new BigDecimal("0.060")),
            new Option("google/gemini-nano-banana-2.1", "Nano Banana 2.1 · calidad y consistencia", new BigDecimal("0.061")),
            new Option("gpt-image-2", "GPT Image 2 · modelo avanzado de OpenAI", new BigDecimal("0.066")),
            new Option("qwen-image-2.1-pro", "Qwen Image 2.1 Pro · alta resolución", new BigDecimal("0.075")),
            new Option("nano-banana-pro", "Nano Banana Pro · calidad profesional", new BigDecimal("0.140")),
            new Option("gpt-image-1.5", "GPT Image 1.5 · opción premium", new BigDecimal("0.167"))
    );
    private static final Set<String> SUPPORTED = CATALOG.stream()
            .map(Option::id)
            .collect(Collectors.toUnmodifiableSet());

    private NanoGptImageModels() {}

    /** Curated choices in ascending approximate USD cost; prices vary by provider parameters. */
    public static List<Option> catalog() {
        return CATALOG;
    }

    public static boolean isSupported(String model) {
        return model != null && SUPPORTED.contains(model);
    }

    public static String normalize(String model) {
        if (model == null || model.isBlank() || model.equals("flux-schnell") || model.equals("flux-dev")) {
            return DEFAULT_MODEL;
        }
        return SUPPORTED.contains(model) ? model : DEFAULT_MODEL;
    }

    public record Option(String id, String name, BigDecimal estimatedPriceUsd) {}
}
