-- Habilitar extensión pgvector si no existe
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla para almacenar el historial de feedback de IA con embeddings vectoriales
CREATE TABLE IF NOT EXISTS feedback_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    texto_generado TEXT NOT NULL,
    tema VARCHAR(255),
    puntaje_usuario INT NOT NULL DEFAULT 0, -- 1 = Like, -1 = Dislike, 0 = Neutral/Borrador
    estructura_usada VARCHAR(50), -- EXPERT, STORYTELLER, PROVOCATIVE
    source_mode VARCHAR(50), -- PROJECT, RESEARCH, BACKUP
    llm_tokens_used INT DEFAULT 0,
    cost_usd NUMERIC(10, 6) DEFAULT 0.0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_ia_tenant ON feedback_ia(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_puntaje ON feedback_ia(puntaje_usuario);
