package com.deyvid.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

/** Durable receipts survive rollback or process failure after an external POST. */
@Service
@RequiredArgsConstructor
public class PublicationAttemptService {
    private final JdbcTemplate jdbc;

    public boolean hasAttempts(UUID draftId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM publication_attempts WHERE draft_id = ?)", Boolean.class, draftId));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claim(UUID tenantId, UUID draftId, UUID accountId, String authorUrn) {
        jdbc.execute("SET LOCAL lock_timeout = '5s'");
        return jdbc.update("INSERT INTO publication_attempts (tenant_id, draft_id, account_id, author_urn, status) VALUES (?, ?, ?, ?, 'SENDING') ON CONFLICT (draft_id, account_id) DO NOTHING",
                tenantId, draftId, accountId, authorUrn) == 1;
    }

    public long countReserved(UUID tenantId, String authorUrn, java.time.Instant since) {
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM publication_attempts WHERE tenant_id = ? AND author_urn = ? AND created_at >= ? AND status IN ('SENDING', 'SUCCESS', 'UNKNOWN')",
                Long.class, tenantId, authorUrn, java.time.OffsetDateTime.ofInstant(since, java.time.ZoneOffset.UTC));
        return count == null ? 0 : count;
    }

    public boolean succeeded(UUID draftId, UUID accountId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM publication_attempts WHERE draft_id = ? AND account_id = ? AND status = 'SUCCESS')",
                Boolean.class, draftId, accountId));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(UUID draftId, UUID accountId, String status, String urn) {
        jdbc.update("UPDATE publication_attempts SET status = ?, linkedin_post_urn = ? WHERE draft_id = ? AND account_id = ?",
                status, urn, draftId, accountId);
    }
}
