package com.deyvid.backend.service.ai;

import com.deyvid.backend.entity.AiUsageEvent;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.repository.AiUsageEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AiUsageEventService {
    private final AiUsageEventRepository repository;

    @Transactional
    public void recordTextGeneration(
            Tenant tenant,
            String provider,
            String model,
            Integer inputTokens,
            Integer outputTokens,
            Integer totalTokens) {
        if (tenant == null || tenant.getId() == null || totalTokens == null || totalTokens < 0) return;

        repository.save(AiUsageEvent.builder()
                .tenant(tenant)
                .provider(clean(provider, "UNKNOWN", 40))
                .model(clean(model, "Modelo no informado", 100))
                .purpose("TEXT_GENERATION")
                .inputTokens(nonNegative(inputTokens))
                .outputTokens(nonNegative(outputTokens))
                .totalTokens(totalTokens)
                // Providers used here do not return an authoritative billed USD amount.
                .costUsd(null)
                .build());
    }

    @Transactional
    public void recordImageGeneration(Tenant tenant, String provider, String model) {
        if (tenant == null || tenant.getId() == null) return;

        repository.save(AiUsageEvent.builder()
                .tenant(tenant)
                .provider(clean(provider, "UNKNOWN", 40))
                .model(clean(model, "Modelo no informado", 100))
                .purpose("IMAGE_GENERATION")
                // Image providers do not return token counts or authoritative billed cost here.
                .inputTokens(null)
                .outputTokens(null)
                .totalTokens(null)
                .costUsd(null)
                .build());
    }

    private Integer nonNegative(Integer value) {
        return value == null || value < 0 ? null : value;
    }

    private String clean(String value, String fallback, int maxLength) {
        if (value == null || value.isBlank()) return fallback;
        String clean = value.trim();
        return clean.substring(0, Math.min(clean.length(), maxLength));
    }
}
