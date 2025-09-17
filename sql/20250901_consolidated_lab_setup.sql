-- Consolidated Lab Analysis & Reference Ranges Setup / Normalization
-- Fecha: 2025-09-01
-- Propósito: Unificar en UN SOLO SCRIPT todos los pasos creados hoy para poder
-- aplicar (o reaplicar) en la base correcta de forma idempotente y llegar
-- directamente al estado FINAL deseado:
--   * Tablas: analysis, analysis_parameters, reference_ranges
--   * Datos normalizados
--   * Constraints finales (sex capitalizado, age_min_unit normalizado)
--   * Índices & únicos para evitar duplicados
--   * Seguro de ejecutar múltiples veces (no debe fallar si ya existe algo)
--
-- Requisitos: PostgreSQL (Supabase) con extensión pgcrypto o similar para gen_random_uuid().
-- Si no está disponible gen_random_uuid(), ajusta a uuid_generate_v4() + extensión uuid-ossp.
--
-- NOTA: Este script NO elimina datos existentes (salvo duplicados exactos en limpieza).
--       Hace una limpieza mínima y luego aplica normalización.
--
-- Rollback: Ver notas al final para revertir constraints/índices si fuera necesario.

BEGIN;

-- 0. Extensión para UUID (si aplica)
DO $$
BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgcrypto';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'No se pudo crear extensión pgcrypto (privilegios). Continuando si ya existe función gen_random_uuid.';
    END;
  END IF;
END$$;

-- 1. Tablas base ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text UNIQUE,
  name text NOT NULL,
  category text,
  description text,
  indications text,
  sample_type text,
  sample_container text,
  processing_time_hours int,
  general_units text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_name ON analysis(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis(category);

CREATE TABLE IF NOT EXISTS analysis_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analysis(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text,
  decimal_places int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reference_ranges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id  uuid NOT NULL REFERENCES analysis_parameters(id) ON DELETE CASCADE,
  sex           text,
  age_min       integer,
  age_max       integer,
  age_min_unit  text,
  lower         numeric,
  upper         numeric,
  text_value    text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- 2. Limpieza de duplicados previa (conserva la primera fila por grupo) ------
-- reference_ranges duplicados exactos (según combinación lógica)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reference_ranges' AND table_schema='public') THEN
    DELETE FROM reference_ranges r
    USING (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY parameter_id,
                            COALESCE(LOWER(sex),'ambos'),
                            COALESCE(age_min,-1),
                            COALESCE(age_max,-1),
                            COALESCE(age_min_unit,'años'),
                            COALESCE(lower,-1),
                            COALESCE(upper,-1),
                            COALESCE(text_value,'')
               ORDER BY id
             ) rn
      FROM reference_ranges
    ) d
    WHERE r.id = d.id AND d.rn > 1;
  END IF;
END$$;

-- analysis_parameters duplicados (analysis_id + lower(name))
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='analysis_parameters' AND table_schema='public') THEN
    DELETE FROM analysis_parameters ap
    USING (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY analysis_id, LOWER(name)
               ORDER BY id
             ) rn
      FROM analysis_parameters
    ) d
    WHERE ap.id = d.id AND d.rn > 1;
  END IF;
END$$;

-- 3. Normalización de analysis_parameters -----------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='analysis_parameters' AND table_schema='public') THEN

    UPDATE analysis_parameters
      SET name = NULLIF(TRIM(name), ''),
          unit = NULLIF(TRIM(unit), '');

    UPDATE analysis_parameters
      SET decimal_places = NULL
      WHERE decimal_places IS NOT NULL AND decimal_places < 0;

    -- Constraint decimal_places >= 0
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_analysis_parameters_decimal_places') THEN
      BEGIN
        ALTER TABLE analysis_parameters
          ADD CONSTRAINT chk_analysis_parameters_decimal_places
          CHECK (decimal_places IS NULL OR decimal_places >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
  END IF;
END$$;

-- 4. Normalización de reference_ranges --------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reference_ranges' AND table_schema='public') THEN
    -- sex a capitalizado: Ambos, Masculino, Femenino
    UPDATE reference_ranges
      SET sex = CASE
        WHEN sex ILIKE 'masc%' THEN 'Masculino'
        WHEN sex ILIKE 'fem%' THEN 'Femenino'
        WHEN sex IS NULL OR TRIM(sex) = '' OR sex ILIKE 'amb%' THEN 'Ambos'
        ELSE INITCAP(LOWER(sex))
      END;

    -- age_min_unit a días / meses / años
    UPDATE reference_ranges
      SET age_min_unit = CASE
        WHEN age_min_unit IS NULL OR TRIM(age_min_unit) = '' THEN 'años'
        WHEN lower(age_min_unit) IN ('dia','d','day','days') THEN 'días'
        WHEN lower(age_min_unit) IN ('dias') THEN 'días'
        WHEN lower(age_min_unit) IN ('mes','month','months','m') THEN 'meses'
        WHEN lower(age_min_unit) IN ('ano','anos','año','años','year','years','y') THEN 'años'
        WHEN lower(age_min_unit) IN ('días','meses','años') THEN age_min_unit
        ELSE 'años'
      END;

    -- Asegurar tildes correctas
    UPDATE reference_ranges SET age_min_unit = 'días' WHERE age_min_unit = 'dias';
    UPDATE reference_ranges SET age_min_unit = 'años' WHERE age_min_unit IN ('anos','ano','año');

    -- Limpiar numéricos si hay strings vacíos (defensivo)
    -- (No se castea texto -> numeric directamente si ya son numeric/int)
    -- Este paso puede omitirse si columnas ya son del tipo correcto.
  END IF;
END$$;

-- 5. Constraints finales para reference_ranges ------------------------------
-- Eliminar cualquier constraint previo de sex
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS reference_ranges_sex_check;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_sex;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_sex_v2;

-- Crear constraint sex final capitalizado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_reference_ranges_sex_v2') THEN
    ALTER TABLE reference_ranges
      ADD CONSTRAINT chk_reference_ranges_sex_v2 CHECK (sex IN ('Ambos','Masculino','Femenino'));
  END IF;
END$$;

-- Eliminar cualquier constraint previo de age_min_unit
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS reference_ranges_age_min_unit_check;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_age_unit;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_age_unit_v2;

-- Crear constraint age_min_unit final
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_reference_ranges_age_unit_v2') THEN
    ALTER TABLE reference_ranges
      ADD CONSTRAINT chk_reference_ranges_age_unit_v2 CHECK (age_min_unit IN ('días','meses','años'));
  END IF;
END$$;

-- 6. Índices & únicos -------------------------------------------------------
-- analysis ya tiene sus índices (se crearon con IF NOT EXISTS al inicio)

-- Índice por analysis_id (rendimiento)
CREATE INDEX IF NOT EXISTS idx_analysis_parameters_analysis_id ON analysis_parameters(analysis_id);
-- (Eliminado soporte de ordering por position; índice removido intencionalmente)

-- Índice único lógico para evitar nombres duplicados por analysis (case-insensitive)
DO $$
BEGIN
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='uq_analysis_parameters_analysis_name' AND n.nspname='public';
  IF NOT FOUND THEN
    BEGIN
      CREATE UNIQUE INDEX uq_analysis_parameters_analysis_name ON analysis_parameters(analysis_id, LOWER(name));
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END$$;

-- Índice por parameter_id en reference_ranges
CREATE INDEX IF NOT EXISTS idx_reference_ranges_parameter_id ON reference_ranges(parameter_id);

-- Índice único para evitar duplicados exactos de rango
DO $$
BEGIN
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='uq_reference_ranges_nodup' AND n.nspname='public';
  IF NOT FOUND THEN
    BEGIN
      CREATE UNIQUE INDEX uq_reference_ranges_nodup ON reference_ranges (
        parameter_id,
        COALESCE(sex,'Ambos'),
        COALESCE(age_min,-1),
        COALESCE(age_max,-1),
        COALESCE(age_min_unit,'años'),
        COALESCE(lower,-1),
        COALESCE(upper,-1),
        COALESCE(text_value,'')
      );
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END$$;

-- Índice único (case-insensitive) para emails en profiles si existe la tabla
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name='profiles' AND table_schema='public'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email'
  ) THEN
    PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relname='uq_profiles_email_ci' AND n.nspname='public';
    IF NOT FOUND THEN
      BEGIN
        CREATE UNIQUE INDEX uq_profiles_email_ci ON profiles (LOWER(email));
      EXCEPTION WHEN duplicate_table THEN NULL; END;
    END IF;
  END IF;
END$$;

-- 7. Sembrar perfiles para usuarios existentes en auth.users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    -- Insert id, email, first_name, last_name and role from auth.users metadata
    INSERT INTO profiles (id, email, first_name, last_name, role)
    SELECT
      u.id,
      u.email,
      u.raw_user_meta_data->>'first_name' AS first_name,
      u.raw_user_meta_data->>'last_name' AS last_name,
      COALESCE(
        u.raw_user_meta_data->>'role',
        u.raw_app_meta_data->>'role',
        ''
      ) AS role
    FROM auth.users u
    ON CONFLICT (id) DO NOTHING;
  END IF;
END$$;

COMMIT;

-- 7. Verificación rápida (NOTICES) ------------------------------------------
DO $$
DECLARE ref_exists boolean; param_exists boolean; BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reference_ranges') INTO ref_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='analysis_parameters') INTO param_exists;
  IF param_exists THEN
    RAISE NOTICE 'analysis_parameters total=%', (SELECT COUNT(*) FROM analysis_parameters);
  END IF;
  IF ref_exists THEN
    RAISE NOTICE 'reference_ranges total=%', (SELECT COUNT(*) FROM reference_ranges);
    RAISE NOTICE 'sex distinct=%', (SELECT array_agg(DISTINCT sex) FROM reference_ranges);
    RAISE NOTICE 'age_min_unit distinct=%', (SELECT array_agg(DISTINCT age_min_unit) FROM reference_ranges);
  END IF;
END$$;

-- 8. Notas de rollback ------------------------------------------------------
-- Para revertir sólo constraints añadidos aquí:
--   ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_sex_v2;
--   ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_age_unit_v2;
--   ALTER TABLE analysis_parameters DROP CONSTRAINT IF EXISTS chk_analysis_parameters_decimal_places;
-- Para remover índices:
--   DROP INDEX IF EXISTS uq_reference_ranges_nodup;
--   DROP INDEX IF EXISTS idx_reference_ranges_parameter_id;
--   DROP INDEX IF EXISTS uq_analysis_parameters_analysis_name;
--   DROP INDEX IF EXISTS idx_analysis_parameters_analysis_id;
-- (Dejar tablas según necesidad).

-- FIN DEL SCRIPT CONSOLIDADO
