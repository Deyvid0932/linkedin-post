CREATE TABLE tenant_ai_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(40) NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_tenant_ai_credentials_tenant_provider UNIQUE (tenant_id, provider),
    CONSTRAINT ck_tenant_ai_credentials_provider CHECK (provider IN ('DEEPSEEK_TEXT', 'NANOGPT_IMAGE'))
);

CREATE INDEX idx_tenant_ai_credentials_tenant ON tenant_ai_credentials(tenant_id);
