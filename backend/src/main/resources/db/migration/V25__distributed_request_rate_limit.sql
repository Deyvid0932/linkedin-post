CREATE TABLE api_request_rate_limit_buckets (
    bucket_key VARCHAR(128) PRIMARY KEY,
    request_limit INTEGER NOT NULL CHECK (request_limit BETWEEN 1 AND 600),
    tokens NUMERIC(14, 8) NOT NULL CHECK (tokens >= 0),
    refilled_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    last_allowed BOOLEAN NOT NULL
);

CREATE INDEX idx_api_request_rate_limit_buckets_last_seen
    ON api_request_rate_limit_buckets (last_seen_at);
