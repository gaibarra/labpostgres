-- Limpieza previa a creación de índices únicos (versión segura)
-- Fecha: 2025-09-01
-- Uso: Ejecutar ANTES de aplicar los scripts de normalización si sospechas duplicados.
-- Esta versión no falla si las tablas aún no existen.

BEGIN;

-- 1. Limpieza de duplicados en reference_ranges (si existe la tabla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reference_ranges'
  ) THEN
    RAISE NOTICE 'Tabla reference_ranges no existe, se omite etapa de limpieza de rangos.';
  ELSE
    DELETE FROM reference_ranges r USING (
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
             ) AS rn
      FROM reference_ranges
    ) d
    WHERE r.id = d.id AND d.rn > 1;
  END IF;
END$$;

-- 2. Limpieza de duplicados en analysis_parameters (si existe la tabla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'analysis_parameters'
  ) THEN
    RAISE NOTICE 'Tabla analysis_parameters no existe, se omite etapa de limpieza de parámetros.';
  ELSE
    DELETE FROM analysis_parameters ap USING (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY analysis_id, LOWER(name)
               ORDER BY id
             ) AS rn
      FROM analysis_parameters
    ) d
    WHERE ap.id = d.id AND d.rn > 1;
  END IF;
END$$;

COMMIT;

-- 3. Verificaciones rápidas posteriores (solo si existen las tablas)
DO $$
DECLARE r_exists boolean; p_exists boolean; BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reference_ranges') INTO r_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analysis_parameters') INTO p_exists;
  IF r_exists THEN
    RAISE NOTICE 'reference_ranges restantes: %', (SELECT COUNT(*) FROM reference_ranges);
  END IF;
  IF p_exists THEN
    RAISE NOTICE 'analysis_parameters restantes: %', (SELECT COUNT(*) FROM analysis_parameters);
  END IF;
END$$;
