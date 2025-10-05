-- Añade columnas de pricing/estado a analysis si no existen
-- Ejecutar en cada base de tenant.
BEGIN;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
-- Index opcional para filtrar activos
CREATE INDEX IF NOT EXISTS idx_analysis_active ON analysis(active);
COMMIT;
