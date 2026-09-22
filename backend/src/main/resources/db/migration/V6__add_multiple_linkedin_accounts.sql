-- =============================================
-- MIGRACIÓN V6: Soporte Multi-Cuenta LinkedIn (Personal y Empresa)
-- =============================================

-- 1. Eliminar la restricción UNIQUE por tenant_id si existe
ALTER TABLE linkedin_credentials DROP CONSTRAINT IF EXISTS linkedin_credentials_tenant_id_key;

-- 2. Agregar nuevas columnas a linkedin_credentials
ALTER TABLE linkedin_credentials
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(30) NOT NULL DEFAULT 'PERSON',
    ADD COLUMN IF NOT EXISTS author_urn VARCHAR(255),
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS vanity_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Migrar datos existentes de forma segura
UPDATE linkedin_credentials 
SET author_urn = COALESCE(person_urn, 'urn:li:person:me'),
    display_name = COALESCE(display_name, 'Perfil Personal'),
    is_primary = TRUE,
    is_enabled = TRUE
WHERE author_urn IS NULL;

-- 4. Asegurar que author_urn sea NOT NULL
ALTER TABLE linkedin_credentials ALTER COLUMN author_urn SET NOT NULL;

-- 5. Crear índice único compuesto (un tenant no puede registrar dos veces el mismo author_urn)
CREATE UNIQUE INDEX IF NOT EXISTS uq_linkedin_tenant_author ON linkedin_credentials(tenant_id, author_urn);

-- 6. Agregar columnas a publication_logs para trazabilidad por cuenta
ALTER TABLE publication_logs
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS author_urn VARCHAR(255);
