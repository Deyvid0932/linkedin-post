package com.deyvid.backend.service.cache;

import com.deyvid.backend.dto.response.SwipeBatchResponse.SwipeVersionDto;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GenerationCacheService {
    private final Map<String, CachedEntry> cache = new ConcurrentHashMap<>();
    private static final Duration TTL = Duration.ofMinutes(15);

    public record CachedEntry(SwipeVersionDto value, Instant createdAt) {
        public boolean isExpired(Duration ttl) {
            return Instant.now().isAfter(createdAt.plus(ttl));
        }
    }

    public Optional<SwipeVersionDto> get(String key) {
        CachedEntry entry = cache.get(key);
        if (entry == null || entry.isExpired(TTL)) {
            if (entry != null) {
                cache.remove(key);
            }
            return Optional.empty();
        }
        return Optional.of(entry.value());
    }

    public void put(String key, SwipeVersionDto value) {
        if (key != null && value != null) {
            cache.put(key, new CachedEntry(value, Instant.now()));
        }
    }

    public void clear() {
        cache.clear();
    }

    public static String buildKey(UUID tenantId, String mode, String topic, String approach, String postLength) {
        String safeTenant = tenantId != null ? tenantId.toString() : "global";
        String safeMode = mode != null ? mode.trim().toUpperCase() : "GENERAL";
        String safeTopic = topic != null ? String.valueOf(topic.trim().hashCode()) : "none";
        String safeApproach = approach != null ? approach.trim().toUpperCase() : "COMPARATIVE_B2B";
        String safeLength = postLength != null ? postLength.trim().toUpperCase() : "MICRO";
        return safeTenant + ":" + safeMode + ":" + safeTopic + ":" + safeApproach + ":" + safeLength;
    }
}
