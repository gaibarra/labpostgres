-- Normalización de datos y restricciones para reference_ranges
-- Fecha: 2025-09-01
-- Objetivo:
--  1. Unificar valores de sex a: 'ambos','masculino','femenino'
--  2. Unificar unidad de edad (age_min_unit) a: 'días','meses','años'
--  3. Asegurar consistencia vía constraints y agregar índice de rendimiento
--  4. Evitar filas duplicadas exactas creando índice único parcial opcional

BEGIN;

DO $$
BEGIN
  -- Verifica existencia de la tabla
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='reference_ranges'
  ) THEN
    RAISE NOTICE 'La tabla reference_ranges no existe. Ejecuta primero 20250901_create_reference_ranges_table.sql';
    RETURN;
  END IF;

  -- 1. Normalizar sex
  UPDATE reference_ranges
    SET sex = CASE
      WHEN sex ILIKE 'masc%' THEN 'masculino'
      WHEN sex ILIKE 'fem%' THEN 'femenino'
      WHEN sex ILIKE 'amb%' OR sex IS NULL OR sex = '' THEN 'ambos'
      ELSE LOWER(sex)
    END;

  -- 2. Normalizar age_min_unit
  UPDATE reference_ranges
    SET age_min_unit = CASE
      WHEN age_min_unit ILIKE 'year%' OR age_min_unit ILIKE 'ano%' OR age_min_unit ILIKE 'años' THEN 'años'
      WHEN age_min_unit ILIKE 'mes%' OR age_min_unit ILIKE 'month%' THEN 'meses'
      WHEN age_min_unit ILIKE 'dia%' OR age_min_unit ILIKE 'day%' THEN 'días'
      ELSE 'años'
    END
    WHERE age_min_unit IS NOT NULL;

  -- 3. Trim
  UPDATE reference_ranges SET sex = TRIM(sex), age_min_unit = TRIM(age_min_unit);

  -- 4. Limpiar numéricos vacíos
  UPDATE reference_ranges
    SET age_min = NULLIF(TRIM(age_min::text), '')::int,
        age_max = NULLIF(TRIM(age_max::text), '')::int,
        lower   = NULLIF(TRIM(lower::text), '')::numeric,
        upper   = NULLIF(TRIM(upper::text), '')::numeric;

  -- 5. Constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_reference_ranges_sex') THEN
    EXECUTE 'ALTER TABLE reference_ranges ADD CONSTRAINT chk_reference_ranges_sex CHECK (sex IN (''ambos'',''masculino'',''femenino''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_reference_ranges_age_unit') THEN
    EXECUTE 'ALTER TABLE reference_ranges ADD CONSTRAINT chk_reference_ranges_age_unit CHECK (age_min_unit IN (''días'',''meses'',''años''))';
  END IF;

  -- 6. Índice
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='idx_reference_ranges_parameter_id' AND n.nspname='public';
  IF NOT FOUND THEN
    EXECUTE 'CREATE INDEX idx_reference_ranges_parameter_id ON reference_ranges(parameter_id)';
  END IF;

  -- 7. Índice único opcional
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='uq_reference_ranges_nodup' AND n.nspname='public'
  ) THEN
  EXECUTE 'CREATE UNIQUE INDEX uq_reference_ranges_nodup ON reference_ranges(\n      parameter_id,\n      COALESCE(sex,''ambos''),\n      COALESCE(age_min,-1),\n      COALESCE(age_max,-1),\n      COALESCE(age_min_unit,''años''),\n      COALESCE(lower,-1),\n      COALESCE(upper,-1),\n      COALESCE(text_value,'''')\n    )';
  END IF;
END$$;

COMMIT;

-- Notas de reversión manual:
--  * Para revertir constraints: ALTER TABLE reference_ranges DROP CONSTRAINT chk_reference_ranges_sex; (igual para age_unit)
--  * Para eliminar índices: DROP INDEX IF EXISTS idx_reference_ranges_parameter_id; DROP INDEX IF EXISTS uq_reference_ranges_nodup;
