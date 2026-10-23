ALTER TABLE tenants
    ADD COLUMN ai_requests_per_minute_expires_at TIMESTAMP WITH TIME ZONE,
    ADD CONSTRAINT chk_tenants_ai_quota_expiry_requires_override
        CHECK (ai_requests_per_minute_expires_at IS NULL OR ai_requests_per_minute IS NOT NULL);

ALTER TABLE users
    ADD COLUMN ai_requests_per_minute_expires_at TIMESTAMP WITH TIME ZONE,
    ADD CONSTRAINT chk_users_ai_quota_expiry_requires_override
        CHECK (ai_requests_per_minute_expires_at IS NULL OR ai_requests_per_minute IS NOT NULL);
