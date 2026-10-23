package com.deyvid.backend.service;

import com.deyvid.backend.dto.response.TopicTrendResponse;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.exception.AiServiceException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class TopicTrendService {
    private static final int RESULT_LIMIT = 50;
    private final WebClient client;

    public TopicTrendService(@Qualifier("genericWebClient") WebClient client) {
        this.client = client;
    }

    public TopicTrendResponse findRecentSignals(Tenant tenant, String requestedNiche, String requestedPeriod) {
        if (tenant == null || tenant.getId() == null) {
            throw new IllegalArgumentException("No se pudo identificar el espacio de trabajo");
        }
        String niche = requestedNiche == null ? "" : requestedNiche.trim();
        if (niche.isBlank() || niche.length() > 160) {
            throw new IllegalArgumentException("El nicho debe tener entre 1 y 160 caracteres");
        }

        Duration period = resolvePeriod(requestedPeriod);
        Instant fetchedAt = Instant.now();
        long since = fetchedAt.minus(period).getEpochSecond();
        var uri = UriComponentsBuilder.fromUriString("https://hn.algolia.com/api/v1/search_by_date")
                .queryParam("query", "{query}")
                .queryParam("tags", "story")
                .queryParam("numericFilters", "created_at_i>{since}")
                .queryParam("hitsPerPage", RESULT_LIMIT)
                .encode()
                .buildAndExpand(Map.of("query", niche, "since", since))
                .toUri();

        try {
            Map<?, ?> response = client.get().uri(uri)
                    .retrieve().bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(10)).block();
            return new TopicTrendResponse(niche,
                    "Hacker News · Algolia · últimos " + periodLabel(requestedPeriod),
                    fetchedAt,
                    parseSignals(response));
        } catch (Exception e) {
            throw new AiServiceException("TREND_SOURCE_UNAVAILABLE",
                    "No se pudieron consultar señales recientes. Puedes reintentar o explorar ideas sin conexión.", e);
        }
    }

    static Duration resolvePeriod(String requestedPeriod) {
        return switch (requestedPeriod == null ? "7d" : requestedPeriod.trim()) {
            case "24h" -> Duration.ofHours(24);
            case "7d" -> Duration.ofDays(7);
            case "30d" -> Duration.ofDays(30);
            default -> throw new IllegalArgumentException("El periodo debe ser 24h, 7d o 30d");
        };
    }

    private static String periodLabel(String requestedPeriod) {
        return switch (requestedPeriod == null ? "7d" : requestedPeriod.trim()) {
            case "24h" -> "24 horas";
            case "7d" -> "7 días";
            case "30d" -> "30 días";
            default -> throw new IllegalArgumentException("El periodo debe ser 24h, 7d o 30d");
        };
    }

    static List<TopicTrendResponse.Signal> parseSignals(Map<?, ?> response) {
        if (response == null || !(response.get("hits") instanceof List<?> hits)) return List.of();
        List<TopicTrendResponse.Signal> signals = new ArrayList<>();
        for (Object value : hits) {
            if (!(value instanceof Map<?, ?> hit)) continue;
            String id = cleanString(hit.get("objectID"), 40);
            String title = cleanString(hit.get("title"), 240);
            if (id.isBlank() || title.isBlank() || !id.matches("[0-9]+")) continue;
            Instant createdAt;
            try {
                createdAt = Instant.parse(cleanString(hit.get("created_at"), 40));
            } catch (Exception ignored) {
                continue;
            }
            signals.add(new TopicTrendResponse.Signal(
                    id,
                    title,
                    "https://news.ycombinator.com/item?id=" + id,
                    number(hit.get("points")),
                    number(hit.get("num_comments")),
                    createdAt));
            if (signals.size() == RESULT_LIMIT) break;
        }
        return List.copyOf(signals);
    }

    private static String cleanString(Object value, int maxLength) {
        if (!(value instanceof String string)) return "";
        String clean = string.trim().replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", "");
        return clean.length() <= maxLength ? clean : clean.substring(0, maxLength);
    }

    private static long number(Object value) {
        return value instanceof Number n ? Math.max(0, n.longValue()) : 0;
    }
}
