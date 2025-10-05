-- Cleanup unificación constraint de sexo en reference_ranges
-- Fecha: 2025-10-04
-- Objetivo: eliminar constraints antiguos y recrear constraint canónico
-- Permitimos NULL para compatibilidad, y tokens capitalizados.
-- Idempotente: sólo crea constraint si no existe el canónico.

BEGIN;

-- 1. Normalizar datos existentes a tokens capitalizados
UPDATE reference_ranges
SET sex = CASE
  WHEN sex ILIKE 'm%' THEN 'Masculino'
  WHEN sex ILIKE 'f%' THEN 'Femenino'
  WHEN sex ILIKE 'a%' THEN 'Ambos'
  ELSE sex
END
WHERE sex IS NOT NULL
  AND sex NOT IN ('Ambos','Masculino','Femenino');

-- 2. Eliminar todos los constraints previos relacionados a sex excepto el canónico final
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid=t.oid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE t.relname='reference_ranges' AND c.contype='c' LOOP
    IF r.conname NOT IN ('reference_ranges_sex_check') THEN
      -- Verificamos si el constraint hace referencia a sex
      IF (SELECT pg_get_constraintdef(c2.oid) FROM pg_constraint c2 WHERE c2.conname=r.conname) ILIKE '%sex%' THEN
        EXECUTE 'ALTER TABLE reference_ranges DROP CONSTRAINT '|| quote_ident(r.conname) ||' CASCADE';
      END IF;
    END IF;
  END LOOP;
END$$;

-- 3. Crear (si falta) el constraint canónico
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid=t.oid
    WHERE t.relname='reference_ranges' AND c.conname='reference_ranges_sex_check'
  ) THEN
    EXECUTE 'ALTER TABLE reference_ranges ADD CONSTRAINT reference_ranges_sex_check CHECK (sex IS NULL OR sex IN (''Ambos'',''Masculino'',''Femenino''))';
  END IF;
END$$;

COMMIT;

-- Verificación sugerida manual:
-- SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid=t.oid WHERE t.relname='reference_ranges';
-- SELECT DISTINCT sex FROM reference_ranges ORDER BY 1;
