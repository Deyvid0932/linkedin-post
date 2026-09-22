-- Agregar campos is_ai_research e is_active a la tabla backup_topics
ALTER TABLE backup_topics ADD COLUMN IF NOT EXISTS is_ai_research BOOLEAN DEFAULT FALSE;
ALTER TABLE backup_topics ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_backup_topics_active_used ON backup_topics(tenant_id, is_active, is_used);
