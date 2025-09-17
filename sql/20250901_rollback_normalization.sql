-- Rollback parcial de normalizaciones del 2025-09-01
-- Nota: No revierte los datos ya transformados, solo elimina constraints e índices añadidos.

BEGIN;

-- Quitar constraints si existen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reference_ranges_sex') THEN
    ALTER TABLE reference_ranges DROP CONSTRAINT chk_reference_ranges_sex;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reference_ranges_age_unit') THEN
    ALTER TABLE reference_ranges DROP CONSTRAINT chk_reference_ranges_age_unit;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_analysis_parameters_decimal_places') THEN
    ALTER TABLE analysis_parameters DROP CONSTRAINT chk_analysis_parameters_decimal_places;
  END IF;
END$$;

-- Eliminar índices (ignora si no existen)
DROP INDEX IF EXISTS idx_reference_ranges_parameter_id;
DROP INDEX IF EXISTS uq_reference_ranges_nodup;
DROP INDEX IF EXISTS idx_analysis_parameters_analysis_id;
DROP INDEX IF EXISTS uq_analysis_parameters_analysis_name;

COMMIT;
