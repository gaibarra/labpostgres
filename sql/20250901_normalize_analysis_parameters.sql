-- Normalización de datos y restricciones para analysis_parameters
-- Fecha: 2025-09-01
-- Objetivo:
--  1. Limpiar espacios y valores inválidos
--  2. Asegurar decimal_places >= 0 o NULL
--  3. Evitar duplicados (analysis_id + nombre) con índice único flexible
--  4. Índices de rendimiento

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='analysis_parameters'
  ) THEN
    RAISE NOTICE 'La tabla analysis_parameters no existe. Ejecuta primero 20250901_create_analysis_parameters_table.sql (si aplica).';
    RETURN;
  END IF;

  -- 1. Limpieza básica de strings
  UPDATE analysis_parameters
    SET name = NULLIF(TRIM(name), ''),
        unit = NULLIF(TRIM(unit), '');

  -- 2. Normalizar decimal_places (negativos o no numéricos => NULL)
  UPDATE analysis_parameters
    SET decimal_places = NULL
    WHERE decimal_places IS NOT NULL AND decimal_places < 0;

  -- 3. Constraint para asegurar valores válidos
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_analysis_parameters_decimal_places'
  ) THEN
    EXECUTE 'ALTER TABLE analysis_parameters ADD CONSTRAINT chk_analysis_parameters_decimal_places CHECK (decimal_places IS NULL OR decimal_places >= 0)';
  END IF;

  -- 4. Índice por analysis_id para listar parámetros rápidamente
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='idx_analysis_parameters_analysis_id' AND n.nspname='public';
  IF NOT FOUND THEN
    EXECUTE 'CREATE INDEX idx_analysis_parameters_analysis_id ON analysis_parameters(analysis_id)';
  END IF;

  -- 5. Índice único lógico para evitar duplicados exactos por estudio y nombre (case-insensitive)
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='uq_analysis_parameters_analysis_name' AND n.nspname='public';
  IF NOT FOUND THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_analysis_parameters_analysis_name ON analysis_parameters(analysis_id, LOWER(name))';
  END IF;
END$$;

COMMIT;

-- Notas:
-- * Si existieran duplicados actuales impedirían crear el índice único; en tal caso ejecute:
--   WITH d AS (
--     SELECT id, ROW_NUMBER() OVER (PARTITION BY analysis_id, LOWER(name) ORDER BY id) rn
--     FROM analysis_parameters
--   ) DELETE FROM analysis_parameters WHERE rn > 1;
--   y luego re-intente la migración.
