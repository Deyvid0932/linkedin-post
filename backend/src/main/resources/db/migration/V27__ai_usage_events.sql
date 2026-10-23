CREATE TABLE ai_usage_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(40) NOT NULL,
    model VARCHAR(100) NOT NULL,
    purpose VARCHAR(40) NOT NULL,
    input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
    output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
    total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
    cost_usd NUMERIC(12, 6),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_usage_events_tenant_created
    ON ai_usage_events (tenant_id, created_at DESC);

CREATE INDEX idx_ai_usage_events_tenant_model_created
    ON ai_usage_events (tenant_id, model, created_at DESC);
