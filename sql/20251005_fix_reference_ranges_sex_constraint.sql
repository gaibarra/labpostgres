-- Corrige/normaliza constraint de sexo en reference_ranges
-- Objetivo: garantizar CHECK ((sex IS NULL) OR (sex = ANY (ARRAY['Ambos','Masculino','Femenino'])))
-- Idempotente: detecta estado actual y sólo aplica cambio si difiere.
DO $$
DECLARE
    r RECORD;
    canonical_exists boolean := false;
    legacy_constraints text[] := ARRAY[]::text[];
    all_constraints text[] := ARRAY[]::text[];
BEGIN
    FOR r IN
        SELECT c.conname, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname='reference_ranges' AND c.contype='c' AND pg_get_constraintdef(c.oid) ILIKE '%sex%'
    LOOP
        all_constraints := array_append(all_constraints, r.conname);
        IF lower(r.def) LIKE '%ambos%' AND lower(r.def) LIKE '%masculino%' AND lower(r.def) LIKE '%femenino%' THEN
            canonical_exists := true;
        ELSIF lower(r.def) LIKE '%''m''::text%' AND lower(r.def) LIKE '%''f''::text%' AND lower(r.def) LIKE '%''o''::text%' THEN
            legacy_constraints := array_append(legacy_constraints, r.conname);
        ELSE
            -- Otras variantes se tratan como legacy si vamos a recrear
            legacy_constraints := array_append(legacy_constraints, r.conname);
        END IF;
    END LOOP;

    IF canonical_exists THEN
        -- Solo eliminar legacy sobrantes
        FOREACH r IN ARRAY legacy_constraints LOOP
            EXECUTE format('ALTER TABLE reference_ranges DROP CONSTRAINT %I', r);
        END LOOP;
    ELSE
        -- No hay canónica: eliminar todas y crear la canónica
        FOREACH r IN ARRAY all_constraints LOOP
            EXECUTE format('ALTER TABLE reference_ranges DROP CONSTRAINT %I', r);
        END LOOP;
        EXECUTE 'ALTER TABLE reference_ranges ADD CONSTRAINT reference_ranges_sex_check CHECK ((sex IS NULL) OR (sex = ANY (ARRAY[''Ambos'',''Masculino'',''Femenino''])));';
    END IF;
END $$;

-- Normalizar datos existentes si hubiese legacy tokens 'M','F','O'
UPDATE reference_ranges
SET sex = CASE sex
            WHEN 'M' THEN 'Masculino'
            WHEN 'F' THEN 'Femenino'
            WHEN 'O' THEN 'Ambos'
            ELSE sex
          END
WHERE sex IN ('M','F','O');

-- Asegurar casing correcto (capitalizado) si quedaron en minúsculas
UPDATE reference_ranges
SET sex = INITCAP(sex)
WHERE sex IS NOT NULL AND sex <> INITCAP(sex);
