ALTER TABLE users
    ADD COLUMN ai_requests_per_minute INTEGER;

ALTER TABLE users
    ADD CONSTRAINT chk_users_ai_requests_per_minute
        CHECK (ai_requests_per_minute IS NULL OR ai_requests_per_minute BETWEEN 1 AND 120);
