package com.deyvid.backend.dto.response;

import java.util.List;

public record TopicExploreResponse(String niche, List<String> ideas, String source) {}
