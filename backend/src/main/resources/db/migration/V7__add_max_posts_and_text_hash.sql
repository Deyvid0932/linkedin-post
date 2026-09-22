-- =============================================
-- MIGRACIÓN V7: Límite diario por cuenta e Idempotencia
-- =============================================

-- 1. Agregar columna max_posts_per_day a linkedin_credentials
ALTER TABLE linkedin_credentials
    ADD COLUMN IF NOT EXISTS max_posts_per_day INT NOT NULL DEFAULT 1;

-- 2. Agregar columna text_hash a publication_logs para idempotencia
ALTER TABLE publication_logs
    ADD COLUMN IF NOT EXISTS text_hash VARCHAR(64);

-- 3. Crear índice para acelerar verificación de idempotencia
CREATE INDEX IF NOT EXISTS idx_publication_logs_tenant_hash ON publication_logs(tenant_id, text_hash, created_at);

-- 4. Permitir múltiples publicaciones en cola por tenant en draft_previews
ALTER TABLE draft_previews DROP CONSTRAINT IF EXISTS draft_previews_tenant_id_key;
ALTER TABLE draft_previews DROP CONSTRAINT IF EXISTS uk1p6w5huly5nkcht4a61gxllqb;
ALTER TABLE draft_previews ADD COLUMN IF NOT EXISTS author_urn VARCHAR(255);
ALTER TABLE draft_previews ADD COLUMN IF NOT EXISTS target_credential_id UUID;
CREATE INDEX IF NOT EXISTS idx_draft_previews_tenant_created ON draft_previews(tenant_id, created_at);
