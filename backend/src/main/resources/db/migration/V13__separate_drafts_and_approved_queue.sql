-- Preserve existing draft metadata; create durable automation/publication receipts.
ALTER TABLE draft_previews
    ADD COLUMN IF NOT EXISTS is_queued BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_preview BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS title VARCHAR(200),
    ADD COLUMN IF NOT EXISTS tone VARCHAR(40),
    ADD COLUMN IF NOT EXISTS audience VARCHAR(200),
    ADD COLUMN IF NOT EXISTS goal VARCHAR(40),
    ADD COLUMN IF NOT EXISTS instructions VARCHAR(1500);
CREATE INDEX IF NOT EXISTS idx_drafts_approved ON draft_previews(tenant_id, created_at) WHERE is_queued;
CREATE TABLE automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES publishing_schedules(id) ON DELETE CASCADE,
    fire_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(schedule_id, fire_at)
);
CREATE TABLE publication_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    draft_id UUID NOT NULL,
    account_id UUID NOT NULL,
    author_urn VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    linkedin_post_urn VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(draft_id, account_id)
);
CREATE INDEX idx_attempt_quota ON publication_attempts(tenant_id, author_urn, created_at);
