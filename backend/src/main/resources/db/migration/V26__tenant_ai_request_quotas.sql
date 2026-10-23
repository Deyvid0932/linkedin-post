ALTER TABLE tenants
    ADD COLUMN ai_requests_per_minute INTEGER;

ALTER TABLE tenants
    ADD CONSTRAINT chk_tenants_ai_requests_per_minute
        CHECK (ai_requests_per_minute IS NULL OR ai_requests_per_minute BETWEEN 1 AND 120);
