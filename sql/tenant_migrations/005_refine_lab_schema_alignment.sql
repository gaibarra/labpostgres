-- 005_refine_lab_schema_alignment.sql
-- Refina y homogeneiza estructura crítica (analysis, analysis_parameters, reference_ranges)
-- Aplica sólo adiciones / constraints idempotentes. NO elimina columnas ni cambia tipos existentes.
-- Asegura claves primarias, unicidad de code, FK en cascada y columnas faltantes.

-- ==========================
-- Tabla: analysis
-- ==========================
CREATE TABLE IF NOT EXISTS public.analysis (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
-- Columnas base
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS clave text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS indications text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS sample_type text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS sample_container text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS processing_time_hours integer;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS general_units text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS price numeric(12,2);
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Unicidad de code (si existe code). Evitar duplicar constraint.
DO $$BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='code'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.contype='u' AND t.relname='analysis' AND c.conname='analysis_code_key'
  ) THEN
    -- Intentar crear unique; si hay duplicados fallará y no rompe el resto.
    BEGIN
      ALTER TABLE public.analysis ADD CONSTRAINT analysis_code_key UNIQUE(code);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'No se pudo crear UNIQUE(code) por duplicados';
    WHEN others THEN
      RAISE NOTICE 'Fallo creando UNIQUE(code): %', SQLERRM;
    END;
  END IF;
END$$;

-- Índice activo
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='active') AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname='idx_analysis_active'
  ) THEN
    CREATE INDEX idx_analysis_active ON public.analysis(active);
  END IF;
END$$;

-- NOT NULL seguros (solo si no hay valores NULL actuales)
DO $$BEGIN
  -- name
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='name') THEN
    IF NOT EXISTS (SELECT 1 FROM analysis WHERE name IS NULL) THEN
      BEGIN
        ALTER TABLE public.analysis ALTER COLUMN name SET NOT NULL;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'No se pudo marcar name NOT NULL: %', SQLERRM;
      END;
    END IF;
  END IF;
  -- code
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='code') THEN
    IF NOT EXISTS (SELECT 1 FROM analysis WHERE code IS NULL) THEN
      BEGIN
        ALTER TABLE public.analysis ALTER COLUMN code SET NOT NULL;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'No se pudo marcar code NOT NULL: %', SQLERRM;
      END;
    END IF;
  END IF;
END$$;

-- ==========================
-- Tabla: analysis_parameters
-- ==========================
CREATE TABLE IF NOT EXISTS public.analysis_parameters (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS analysis_id uuid;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS decimal_places integer;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- FK a analysis (ON DELETE CASCADE)
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis_parameters' AND column_name='analysis_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      WHERE c.contype='f' AND t.relname='analysis_parameters' AND c.conname='analysis_parameters_analysis_id_fkey'
    ) THEN
      BEGIN
        ALTER TABLE public.analysis_parameters
          ADD CONSTRAINT analysis_parameters_analysis_id_fkey FOREIGN KEY (analysis_id)
          REFERENCES public.analysis(id) ON DELETE CASCADE;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'No se pudo crear FK analysis_parameters.analysis_id: %', SQLERRM;
      END;
    END IF;
  END IF;
END$$;

-- Índice para joins
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis_parameters' AND column_name='analysis_id')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_analysis_parameters_analysis_id') THEN
    CREATE INDEX idx_analysis_parameters_analysis_id ON public.analysis_parameters(analysis_id);
  END IF;
END$$;

-- NOT NULL seguros
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis_parameters' AND column_name='name') AND NOT EXISTS (SELECT 1 FROM analysis_parameters WHERE name IS NULL) THEN
    BEGIN
      ALTER TABLE public.analysis_parameters ALTER COLUMN name SET NOT NULL;
    EXCEPTION WHEN others THEN RAISE NOTICE 'No se pudo marcar name NOT NULL en analysis_parameters: %', SQLERRM; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis_parameters' AND column_name='analysis_id') AND NOT EXISTS (SELECT 1 FROM analysis_parameters WHERE analysis_id IS NULL) THEN
    BEGIN
      ALTER TABLE public.analysis_parameters ALTER COLUMN analysis_id SET NOT NULL;
    EXCEPTION WHEN others THEN RAISE NOTICE 'No se pudo marcar analysis_id NOT NULL: %', SQLERRM; END;
  END IF;
END$$;

-- ==========================
-- Tabla: reference_ranges
-- ==========================
CREATE TABLE IF NOT EXISTS public.reference_ranges (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS parameter_id uuid;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS sex text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS age_min integer;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS age_max integer;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS age_min_unit text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS lower numeric;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS upper numeric;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS text_value text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- FK a analysis_parameters
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reference_ranges' AND column_name='parameter_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      WHERE c.contype='f' AND t.relname='reference_ranges' AND c.conname='reference_ranges_parameter_id_fkey'
    ) THEN
      BEGIN
        ALTER TABLE public.reference_ranges
          ADD CONSTRAINT reference_ranges_parameter_id_fkey FOREIGN KEY (parameter_id)
          REFERENCES public.analysis_parameters(id) ON DELETE CASCADE;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'No se pudo crear FK reference_ranges.parameter_id: %', SQLERRM;
      END;
    END IF;
  END IF;
END$$;

-- Índice para joins
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reference_ranges' AND column_name='parameter_id')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_reference_ranges_parameter_id') THEN
    CREATE INDEX idx_reference_ranges_parameter_id ON public.reference_ranges(parameter_id);
  END IF;
END$$;

-- ==========================
-- Sin cambios destructivos; safe para todos los tenants.
