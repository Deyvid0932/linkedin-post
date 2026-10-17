-- =============================================
-- MIGRACIÓN V10: Columnas faltantes con valores por defecto
-- =============================================

ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS token_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE draft_previews
    ADD COLUMN IF NOT EXISTS is_queued BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_preview BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS title VARCHAR(200),
    ADD COLUMN IF NOT EXISTS tone VARCHAR(40),
    ADD COLUMN IF NOT EXISTS audience VARCHAR(200),
    ADD COLUMN IF NOT EXISTS goal VARCHAR(40),
    ADD COLUMN IF NOT EXISTS instructions VARCHAR(1500);

ALTER TABLE password_reset_tokens
    ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
