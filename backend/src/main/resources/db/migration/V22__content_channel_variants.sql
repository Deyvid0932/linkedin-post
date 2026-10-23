CREATE TABLE content_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    draft_id UUID NOT NULL REFERENCES draft_previews(id) ON DELETE CASCADE,
    channel VARCHAR(24) NOT NULL,
    content_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_content_variants_draft_channel UNIQUE (draft_id, channel),
    CONSTRAINT ck_content_variants_channel CHECK (channel IN ('X', 'YOUTUBE_SHORTS', 'TIKTOK'))
);

CREATE INDEX idx_content_variants_tenant_draft_updated
    ON content_variants (tenant_id, draft_id, updated_at DESC);
