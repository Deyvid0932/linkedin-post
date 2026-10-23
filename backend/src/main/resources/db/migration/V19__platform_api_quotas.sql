CREATE TABLE platform_api_quota_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    auth_requests_per_minute INTEGER NOT NULL CHECK (auth_requests_per_minute BETWEEN 1 AND 120),
    ai_requests_per_minute INTEGER NOT NULL CHECK (ai_requests_per_minute BETWEEN 1 AND 120),
    api_requests_per_minute INTEGER NOT NULL CHECK (api_requests_per_minute BETWEEN 1 AND 600),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO platform_api_quota_settings (id, auth_requests_per_minute, ai_requests_per_minute, api_requests_per_minute)
VALUES (1, 20, 10, 120);
