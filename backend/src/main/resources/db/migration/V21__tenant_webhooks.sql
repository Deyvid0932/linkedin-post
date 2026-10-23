CREATE TABLE tenant_webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    target_host VARCHAR(253) NOT NULL,
    target_url_enc TEXT NOT NULL,
    secret_enc TEXT NOT NULL,
    subscribed_events VARCHAR(160) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_webhook_endpoints_tenant_active ON tenant_webhook_endpoints(tenant_id, is_active);

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint_id UUID NOT NULL REFERENCES tenant_webhook_endpoints(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload_json TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    http_status INTEGER,
    response_summary VARCHAR(500),
    delivered_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_webhook_deliveries_endpoint_event UNIQUE (endpoint_id, event_id),
    CONSTRAINT ck_webhook_deliveries_status CHECK (status IN ('PENDING', 'SENDING', 'DELIVERED', 'FAILED')),
    CONSTRAINT ck_webhook_deliveries_event CHECK (event_type IN ('post.published', 'post.delivery_unknown', 'webhook.test'))
);

CREATE INDEX idx_webhook_deliveries_tenant_created ON webhook_deliveries(tenant_id, created_at DESC);
