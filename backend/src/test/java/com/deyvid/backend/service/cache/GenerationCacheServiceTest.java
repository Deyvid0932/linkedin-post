package com.deyvid.backend.service.cache;

import com.deyvid.backend.dto.response.SwipeBatchResponse.SwipeVersionDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class GenerationCacheServiceTest {

    private GenerationCacheService cacheService;

    @BeforeEach
    void setUp() {
        cacheService = new GenerationCacheService();
    }

    @Test
    void testPutAndGet() {
        UUID tenantId = UUID.randomUUID();
        String key = GenerationCacheService.buildKey(tenantId, "RESEARCH", "Kafka vs RabbitMQ", "COMPARATIVE_B2B", "MICRO");

        SwipeVersionDto dto = new SwipeVersionDto(
                "v-1", "COMPARATIVE_B2B", "Titulo 1", "Texto generado", "http://img.png", 200, 0.0009, 1500.0
        );

        cacheService.put(key, dto);

        Optional<SwipeVersionDto> cached = cacheService.get(key);
        assertTrue(cached.isPresent());
        assertEquals("Texto generado", cached.get().textoGenerado());
        assertEquals("v-1", cached.get().id());
    }

    @Test
    void testGetNonExistentReturnsEmpty() {
        Optional<SwipeVersionDto> cached = cacheService.get("non-existent-key");
        assertTrue(cached.isEmpty());
    }

    @Test
    void testBuildKeyConsistency() {
        UUID tenantId = UUID.randomUUID();
        String key1 = GenerationCacheService.buildKey(tenantId, "RESEARCH", "Topic A", "STORYTELLER", "DETAILED");
        String key2 = GenerationCacheService.buildKey(tenantId, "RESEARCH", "Topic A", "STORYTELLER", "DETAILED");

        assertEquals(key1, key2);
        assertTrue(key1.contains("STORYTELLER"));
        assertTrue(key1.contains("DETAILED"));
    }
}