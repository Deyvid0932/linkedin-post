package com.deyvid.backend.dto.request;

import java.util.List;
import java.util.UUID;

public record BulkTopicRequests(
        List<ReorderItem> reorderList,
        List<BackupTopicItem> backupTopics,
        String rawBulkText,
        Boolean isAiResearchDefault
) {
    public record ReorderItem(
            UUID id,
            int priority
    ) {}

    public record BackupTopicItem(
            String title,
            String description,
            String category,
            Integer priority,
            Boolean isAiResearch
    ) {}
}
