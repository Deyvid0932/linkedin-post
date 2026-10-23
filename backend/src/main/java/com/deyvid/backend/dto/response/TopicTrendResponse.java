package com.deyvid.backend.dto.response;

import java.time.Instant;
import java.util.List;

public record TopicTrendResponse(String niche, String source, Instant fetchedAt, List<Signal> signals) {
    public record Signal(String id, String title, String discussionUrl, long points, long comments, Instant createdAt) {}
}
