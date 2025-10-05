-- Normalización definitiva de valores de sexo en reference_ranges a formato capitalizado
-- Ejecutar en ventana de mantenimiento corta. Idempotente en la práctica (UPDATE sólo toca filas divergentes).
-- Fecha: 2025-10-04

BEGIN;

-- 1. Normalizar datos existentes
UPDATE reference_ranges
SET sex = CASE
  WHEN sex ILIKE 'm%' THEN 'Masculino'
  WHEN sex ILIKE 'f%' THEN 'Femenino'
  ELSE 'Ambos'
END
WHERE sex IS NOT NULL
  AND sex NOT IN ('Ambos','Masculino','Femenino');

-- 2. Quitar constraint previo si existe (ajusta el nombre si era distinto)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT conname FROM pg_constraint
             JOIN pg_class t ON pg_constraint.conrelid = t.oid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE t.relname='reference_ranges' AND pg_constraint.contype='c' LOOP
    IF rec.conname = 'reference_ranges_sex_check' THEN
      EXECUTE 'ALTER TABLE reference_ranges DROP CONSTRAINT ' || rec.conname || ' CASCADE';
    END IF;
  END LOOP;
END$$;

-- 3. Crear nuevo constraint estricto capitalizado
ALTER TABLE reference_ranges
  ADD CONSTRAINT reference_ranges_sex_check
  CHECK (sex IN ('Ambos','Masculino','Femenino'));

COMMIT;

-- Verificación rápida (opcional)
-- SELECT sex, COUNT(*) FROM reference_ranges GROUP BY 1 ORDER BY 1;
