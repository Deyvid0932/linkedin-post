CREATE TABLE github_linkedin_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
    linkedin_credential_id UUID NOT NULL REFERENCES linkedin_credentials(id) ON DELETE CASCADE,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    last_synced_at TIMESTAMPTZ,
    last_error VARCHAR(40),
    CONSTRAINT uk_github_linkedin_binding_repo UNIQUE (repository_id),
    CONSTRAINT chk_github_linkedin_binding_status CHECK (sync_status IN ('PENDING', 'SYNCED'))
);

CREATE INDEX idx_github_linkedin_bindings_account ON github_linkedin_bindings (linkedin_credential_id);
