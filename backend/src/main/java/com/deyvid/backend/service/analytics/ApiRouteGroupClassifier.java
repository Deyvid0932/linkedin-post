package com.deyvid.backend.service.analytics;

public final class ApiRouteGroupClassifier {
    private ApiRouteGroupClassifier() {}

    public static String classify(String path) {
        if (path.startsWith("/api/v1/auth/")) return "auth";
        if (path.contains("/generate") || path.contains("/swipe-") || path.contains("/search-image")
                || path.endsWith("/stream") || path.endsWith("/daily-suggestion")) return "ai";
        return "api";
    }
}
