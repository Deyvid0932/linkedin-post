-- =============================================
-- AGREGAR COLUMNA is_rejected A backup_topics
-- =============================================
ALTER TABLE backup_topics ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN NOT NULL DEFAULT FALSE;
