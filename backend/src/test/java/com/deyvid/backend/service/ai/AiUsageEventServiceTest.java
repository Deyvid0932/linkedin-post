package com.deyvid.backend.service.ai;

import com.deyvid.backend.entity.AiUsageEvent;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.repository.AiUsageEventRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiUsageEventServiceTest {
    @Test
    void persistsOnlyProviderReportedTokenCountsAndLeavesUnknownCostNull() {
        AtomicReference<AiUsageEvent> saved = new AtomicReference<>();
        AiUsageEventRepository repository = repository(saved);
        Tenant tenant = Tenant.builder().id(UUID.randomUUID()).build();
        AiUsageEventService service = new AiUsageEventService(repository);

        service.recordTextGeneration(tenant, "api.example.test", "model-v2", 31, 12, 43);

        AiUsageEvent event = saved.get();
        assertNotNull(event);
        assertEquals(tenant.getId(), event.getTenant().getId());
        assertEquals("api.example.test", event.getProvider());
        assertEquals("model-v2", event.getModel());
        assertEquals(31, event.getInputTokens());
        assertEquals(12, event.getOutputTokens());
        assertEquals(43, event.getTotalTokens());
        assertNull(event.getCostUsd());
    }

    @Test
    void skipsMissingTenantOrUnreportedTotalInsteadOfInventingUsage() {
        AtomicReference<AiUsageEvent> saved = new AtomicReference<>();
        AiUsageEventRepository repository = repository(saved);
        AiUsageEventService service = new AiUsageEventService(repository);

        service.recordTextGeneration(null, "provider", "model", 10, 5, 15);
        service.recordTextGeneration(Tenant.builder().id(UUID.randomUUID()).build(), "provider", "model", 10, 5, null);

        assertNull(saved.get());
    }

    @Test
    void recordsSuccessfulImageGenerationWithoutInventingTokensOrCost() {
        AtomicReference<AiUsageEvent> saved = new AtomicReference<>();
        AiUsageEventService service = new AiUsageEventService(repository(saved));
        Tenant tenant = Tenant.builder().id(UUID.randomUUID()).build();

        service.recordImageGeneration(tenant, "NanoGPT", "nano-banana");

        AiUsageEvent event = saved.get();
        assertNotNull(event);
        assertEquals(tenant.getId(), event.getTenant().getId());
        assertEquals("NanoGPT", event.getProvider());
        assertEquals("nano-banana", event.getModel());
        assertEquals("IMAGE_GENERATION", event.getPurpose());
        assertNull(event.getInputTokens());
        assertNull(event.getOutputTokens());
        assertNull(event.getTotalTokens());
        assertNull(event.getCostUsd());
    }

    private AiUsageEventRepository repository(AtomicReference<AiUsageEvent> saved) {
        return (AiUsageEventRepository) Proxy.newProxyInstance(
                AiUsageEventRepository.class.getClassLoader(), new Class<?>[]{AiUsageEventRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("save")) {
                        AiUsageEvent event = (AiUsageEvent) args[0];
                        saved.set(event);
                        return event;
                    }
                    if (method.getDeclaringClass() == Object.class) return switch (method.getName()) {
                        case "toString" -> "In-memory AI usage repository";
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == args[0];
                        default -> null;
                    };
                    throw new UnsupportedOperationException(method.getName());
                });
    }
}
