package com.deyvid.backend.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TopicTrendServiceTest {
    @Test
    void acceptsOnlySupportedTimeWindows() {
        assertEquals(Duration.ofHours(24), TopicTrendService.resolvePeriod("24h"));
        assertEquals(Duration.ofDays(7), TopicTrendService.resolvePeriod("7d"));
        assertEquals(Duration.ofDays(30), TopicTrendService.resolvePeriod("30d"));
        assertEquals(Duration.ofDays(7), TopicTrendService.resolvePeriod(null));
        assertThrows(IllegalArgumentException.class, () -> TopicTrendService.resolvePeriod("all"));
        assertThrows(IllegalArgumentException.class, () -> TopicTrendService.resolvePeriod("7d&tags=comment"));
    }

    @Test
    void returnsBoundedSignalsWithLinksOnTheTrustedDiscussionDomain() {
        Map<String, Object> response = Map.of("hits", List.of(
                Map.of("objectID", "98765", "title", "PostgreSQL query planning", "points", 31,
                        "num_comments", 8, "created_at", "2026-10-16T10:00:00Z"),
                Map.of("objectID", "not-a-number", "title", "Injected title", "points", 500,
                        "num_comments", 30, "created_at", "2026-10-16T11:00:00Z")));

        var signals = TopicTrendService.parseSignals(response);

        assertEquals(1, signals.size());
        assertEquals("https://news.ycombinator.com/item?id=98765", signals.get(0).discussionUrl());
        assertEquals(31, signals.get(0).points());
        assertEquals(Instant.parse("2026-10-16T10:00:00Z"), signals.get(0).createdAt());
    }

    @Test
    void ignoresMalformedRecordsAndMissingHitLists() {
        assertEquals(List.of(), TopicTrendService.parseSignals(Map.of("hits", "unexpected")));
        assertEquals(List.of(), TopicTrendService.parseSignals(null));
    }
}
