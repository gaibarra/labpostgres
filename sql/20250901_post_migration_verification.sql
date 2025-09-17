-- Script de verificación posterior a migraciones de normalización (versión segura)
-- Ejecutar después de:
--  * 20250901_normalize_reference_ranges.sql
--  * 20250901_normalize_analysis_parameters.sql

-- Este script NO fallará si una de las tablas aún no existe; emitirá NOTICE.

DO $$
DECLARE ref_exists boolean; param_exists boolean; BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='reference_ranges') INTO ref_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='analysis_parameters') INTO param_exists;

  -- 1. Conteo general
  IF ref_exists THEN
    RAISE NOTICE 'reference_ranges total=%', (SELECT COUNT(*) FROM reference_ranges);
  ELSE
    RAISE NOTICE 'Tabla reference_ranges no existe.';
  END IF;
  IF param_exists THEN
    RAISE NOTICE 'analysis_parameters total=%', (SELECT COUNT(*) FROM analysis_parameters);
  ELSE
    RAISE NOTICE 'Tabla analysis_parameters no existe.';
  END IF;

  -- 2 & 3. Distintos sex y unidades
  IF ref_exists THEN
    RAISE NOTICE 'sex distinct=%', (SELECT array_agg(DISTINCT sex) FROM reference_ranges);
    RAISE NOTICE 'age_min_unit distinct=%', (SELECT array_agg(DISTINCT age_min_unit) FROM reference_ranges);
  END IF;

  -- 4. Inconsistencias rango
  IF ref_exists THEN
    RAISE NOTICE 'rango inconsistencias lower>upper=%', (SELECT COUNT(*) FROM reference_ranges WHERE lower IS NOT NULL AND upper IS NOT NULL AND lower > upper);
  END IF;

  -- 5. Parámetros sin rangos
  IF param_exists THEN
    IF ref_exists THEN
      RAISE NOTICE 'Primeros 10 parámetros sin rangos:';
      PERFORM * FROM (
        SELECT ap.analysis_id, ap.id AS parameter_id, ap.name
        FROM analysis_parameters ap
        LEFT JOIN reference_ranges rr ON rr.parameter_id = ap.id
        GROUP BY ap.analysis_id, ap.id, ap.name
        HAVING COUNT(rr.id) = 0
        ORDER BY ap.analysis_id
        LIMIT 10
      ) t;
    END IF;
  END IF;

  -- 6. Duplicados potenciales de parámetros
  IF param_exists THEN
    RAISE NOTICE 'Duplicados logical (analysis_id, lower(name)):';
    PERFORM * FROM (
      SELECT analysis_id, LOWER(name) AS lname, COUNT(*) c
      FROM analysis_parameters
      GROUP BY analysis_id, LOWER(name)
      HAVING COUNT(*) > 1
      LIMIT 10
    ) d;
  END IF;

  -- 7. Rangos duplicados exactos
  IF ref_exists THEN
    RAISE NOTICE 'Rangos duplicados exactos (primeros 10 si hay):';
    PERFORM * FROM (
      SELECT parameter_id, sex, COALESCE(age_min,-1) age_min, COALESCE(age_max,-1) age_max,
             age_min_unit, COALESCE(lower,-1) lower, COALESCE(upper,-1) upper,
             COALESCE(text_value,'') text_value, COUNT(*) c
      FROM reference_ranges
      GROUP BY 1,2,3,4,5,6,7,8
      HAVING COUNT(*) > 1
      LIMIT 10
    ) rrdup;
  END IF;

  -- 8. Distribución de parámetros por estudio
  IF param_exists THEN
    RAISE NOTICE 'Top 10 estudios por cantidad de parámetros:';
    PERFORM * FROM (
      SELECT analysis_id, COUNT(*) param_count
      FROM analysis_parameters
      GROUP BY analysis_id
      ORDER BY param_count DESC NULLS LAST
      LIMIT 10
    ) dist;
  END IF;

  -- 9. Nulos críticos
  IF param_exists THEN
    RAISE NOTICE 'Parámetros con name NULL=%', (SELECT COUNT(*) FROM analysis_parameters WHERE name IS NULL);
  END IF;

  -- 10. Muestra de rangos
  IF ref_exists THEN
    RAISE NOTICE 'Muestra 5 reference_ranges:';
    PERFORM * FROM (
      SELECT id, parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, text_value
      FROM reference_ranges LIMIT 5
    ) sample_rr;
  END IF;
END$$;
