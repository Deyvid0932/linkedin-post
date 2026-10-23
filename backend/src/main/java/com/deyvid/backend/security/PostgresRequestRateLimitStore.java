package com.deyvid.backend.security;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class PostgresRequestRateLimitStore implements RequestRateLimitStore {
    private static final String CONSUME_SQL = """
            INSERT INTO api_request_rate_limit_buckets
                (bucket_key, request_limit, tokens, refilled_at, last_seen_at, last_allowed)
            VALUES (?, ?, GREATEST(0, ? - 1), clock_timestamp(), clock_timestamp(), TRUE)
            ON CONFLICT (bucket_key) DO UPDATE SET
                request_limit = EXCLUDED.request_limit,
                tokens = CASE WHEN LEAST(EXCLUDED.request_limit::numeric,
                    api_request_rate_limit_buckets.tokens
                    + GREATEST(0, EXTRACT(EPOCH FROM (EXCLUDED.refilled_at - api_request_rate_limit_buckets.refilled_at)) * 1000)
                      * EXCLUDED.request_limit::numeric / 60000) >= 1
                    THEN LEAST(EXCLUDED.request_limit::numeric,
                        api_request_rate_limit_buckets.tokens
                        + GREATEST(0, EXTRACT(EPOCH FROM (EXCLUDED.refilled_at - api_request_rate_limit_buckets.refilled_at)) * 1000)
                          * EXCLUDED.request_limit::numeric / 60000) - 1
                    ELSE LEAST(EXCLUDED.request_limit::numeric,
                        api_request_rate_limit_buckets.tokens
                        + GREATEST(0, EXTRACT(EPOCH FROM (EXCLUDED.refilled_at - api_request_rate_limit_buckets.refilled_at)) * 1000)
                          * EXCLUDED.request_limit::numeric / 60000)
                    END,
                last_allowed = LEAST(EXCLUDED.request_limit::numeric,
                    api_request_rate_limit_buckets.tokens
                    + GREATEST(0, EXTRACT(EPOCH FROM (EXCLUDED.refilled_at - api_request_rate_limit_buckets.refilled_at)) * 1000)
                      * EXCLUDED.request_limit::numeric / 60000) >= 1,
                refilled_at = EXCLUDED.refilled_at,
                last_seen_at = EXCLUDED.last_seen_at
            RETURNING last_allowed, tokens
            """;
    private static final String DELETE_EXPIRED_SQL = """
            DELETE FROM api_request_rate_limit_buckets
            WHERE last_seen_at < clock_timestamp() - INTERVAL '2 minutes'
            """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public Decision consume(String bucketKey, int limitPerMinute) {
        return jdbcTemplate.queryForObject(CONSUME_SQL,
                (resultSet, rowNumber) -> new Decision(resultSet.getBoolean("last_allowed"), resultSet.getDouble("tokens")),
                bucketKey, limitPerMinute, limitPerMinute);
    }

    @Override
    public void deleteExpiredBuckets() {
        jdbcTemplate.update(DELETE_EXPIRED_SQL);
    }
}
