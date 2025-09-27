-- Añade columna integrations_meta para metadata de secretos de integraciones
ALTER TABLE lab_configuration
  ADD COLUMN IF NOT EXISTS integrations_meta jsonb DEFAULT '{}'::jsonb;

-- Index potencial futuro si se consultan campos específicos (comentado por ahora)
-- CREATE INDEX IF NOT EXISTS idx_lab_configuration_integrations_meta ON lab_configuration USING gin (integrations_meta);
