-- Actualización del constraint de age_min_unit en reference_ranges
-- Fecha: 2025-09-01
-- Objetivo:
--   * Normalizar age_min_unit a valores canónicos: 'días','meses','años'
--   * Remover variantes (day/days/dia/dias/month/months/mes/year/years/ano/anos/...) 
--   * Reemplazar constraint previo por uno nuevo consistente

BEGIN;

-- 1. Normalización de valores
UPDATE reference_ranges
SET age_min_unit = CASE
  WHEN age_min_unit IS NULL OR TRIM(age_min_unit) = '' THEN 'años'
  WHEN lower(age_min_unit) IN ('dia','d','day','days') THEN 'días'
  WHEN lower(age_min_unit) IN ('dias') THEN 'días'
  WHEN lower(age_min_unit) IN ('mes','month','months','m') THEN 'meses'
  WHEN lower(age_min_unit) IN ('ano','anos','año','años','year','years','y') THEN 'años'
  ELSE age_min_unit  -- se asume ya normalizado ('días','meses','años')
END;

-- 2. Asegurar acentos correctos (casos sin tilde)
UPDATE reference_ranges SET age_min_unit = 'días' WHERE age_min_unit = 'dias';
UPDATE reference_ranges SET age_min_unit = 'años' WHERE age_min_unit IN ('anos','ano','año');

-- 3. Eliminar constraint antiguo si existe
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS reference_ranges_age_min_unit_check;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_age_unit;

-- 4. Crear nuevo constraint
DO $$BEGIN
  PERFORM 1 FROM pg_constraint WHERE conname='chk_reference_ranges_age_unit_v2';
  IF NOT FOUND THEN
    BEGIN
      ALTER TABLE reference_ranges
        ADD CONSTRAINT chk_reference_ranges_age_unit_v2 CHECK (age_min_unit IN ('días','meses','años'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

COMMIT;

-- Rollback manual:
-- ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_age_unit_v2;
