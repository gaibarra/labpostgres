-- Actualización del constraint de sex en reference_ranges para usar valores capitalizados
-- Fecha: 2025-09-01
-- Objetivo:
--   * Normalizar datos existentes a 'Ambos','Masculino','Femenino'
--   * Eliminar constraints previos que usaban minúsculas
--   * Crear un nuevo constraint consistente con el código actual

BEGIN;

-- 1. Normalizar datos existentes
UPDATE reference_ranges
SET sex = CASE
  WHEN lower(sex) LIKE 'masc%' THEN 'Masculino'
  WHEN lower(sex) LIKE 'fem%' THEN 'Femenino'
  ELSE 'Ambos'
END;

-- 2. Eliminar constraints anteriores (nombres posibles)
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS reference_ranges_sex_check;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_sex;

-- 3. Crear nuevo constraint
DO $$BEGIN
  PERFORM 1 FROM pg_constraint WHERE conname='chk_reference_ranges_sex_v2';
  IF NOT FOUND THEN
    BEGIN
      ALTER TABLE reference_ranges
        ADD CONSTRAINT chk_reference_ranges_sex_v2 CHECK (sex IN ('Ambos','Masculino','Femenino'));
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

COMMIT;

-- Rollback manual (si fuese necesario):
-- ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_sex_v2;
-- (y volver a crear constraint previo según corresponda)
