CREATE TABLE linkedin_oauth_states (
    state_hash VARCHAR(64) PRIMARY KEY,
    browser_hash VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_linkedin_oauth_states_expiry ON linkedin_oauth_states (expires_at);
