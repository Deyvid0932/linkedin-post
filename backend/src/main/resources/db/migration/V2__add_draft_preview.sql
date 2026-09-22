-- =============================================
-- TABLA: draft_previews
-- Previsualización IA persistida por tenant
-- Se sobrescribe cada vez que se regenera
-- =============================================
CREATE TABLE draft_previews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    source_mode         VARCHAR(20) NOT NULL CHECK (source_mode IN ('PROJECT', 'RESEARCH', 'BACKUP')),
    generated_text      TEXT,
    image_url           TEXT,
    source_reference    TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
