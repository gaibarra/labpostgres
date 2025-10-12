-- 20251011_dedupe_reference_ranges_and_unique_index.sql
-- Objetivo: eliminar duplicados exactos en tablas de rangos (legacy y moderna) y
-- establecer índices únicos compuestos para prevenir reaparición de duplicados.
-- La definición respeta columnas opcionales y usa COALESCE para llaves naturales.

DO $$
BEGIN
  -- 1) Limpiar duplicados exactos en reference_ranges (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reference_ranges') THEN
    -- Detectar si existen columnas lower/upper (vs min_value/max_value)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='reference_ranges' AND column_name='lower'
    ) THEN
      -- Variante con lower/upper
      EXECUTE $dedupe$
        DELETE FROM reference_ranges rr USING (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY parameter_id,
                                  COALESCE(sex,'Ambos'),
                                  COALESCE(age_min,-1),
                                  COALESCE(age_max,-1),
                                  COALESCE(age_min_unit,'años'),
                                  COALESCE(lower,-999999),
                                  COALESCE(upper,-999999),
                                  COALESCE(text_value,'')
                     ORDER BY id
                   ) AS rn
            FROM reference_ranges
          ) t
          WHERE t.rn > 1
        ) d
        WHERE rr.id = d.id
      $dedupe$;

      BEGIN
        EXECUTE $uniq$
          CREATE UNIQUE INDEX IF NOT EXISTS uq_reference_ranges_nodup ON reference_ranges(
            parameter_id,
            COALESCE(sex,'Ambos'),
            COALESCE(age_min,-1),
            COALESCE(age_max,-1),
            COALESCE(age_min_unit,'años'),
            COALESCE(lower,-999999),
            COALESCE(upper,-999999),
            COALESCE(text_value,'')
          )
        $uniq$;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo crear índice único en reference_ranges (lower/upper): %', SQLERRM;
      END;
    ELSE
      -- Variante con min_value/max_value
      EXECUTE $dedupe$
        DELETE FROM reference_ranges rr USING (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY parameter_id,
                                  COALESCE(sex,'Ambos'),
                                  COALESCE(age_min,-1),
                                  COALESCE(age_max,-1),
                                  COALESCE(age_min_unit,'años'),
                                  COALESCE(min_value,-999999),
                                  COALESCE(max_value,-999999),
                                  COALESCE(text_value,'')
                     ORDER BY id
                   ) AS rn
            FROM reference_ranges
          ) t
          WHERE t.rn > 1
        ) d
        WHERE rr.id = d.id
      $dedupe$;

      BEGIN
        EXECUTE $uniq$
          CREATE UNIQUE INDEX IF NOT EXISTS uq_reference_ranges_nodup ON reference_ranges(
            parameter_id,
            COALESCE(sex,'Ambos'),
            COALESCE(age_min,-1),
            COALESCE(age_max,-1),
            COALESCE(age_min_unit,'años'),
            COALESCE(min_value,-999999),
            COALESCE(max_value,-999999),
            COALESCE(text_value,'')
          )
        $uniq$;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo crear índice único en reference_ranges (min/max): %', SQLERRM;
      END;
    END IF;
  END IF;

  -- 2) Limpiar duplicados exactos en analysis_reference_ranges (moderno)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analysis_reference_ranges') THEN
    DELETE FROM analysis_reference_ranges rr USING (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY parameter_id,
                              COALESCE(sex,'Ambos'),
                              COALESCE(age_min,-1),
                              COALESCE(age_max,-1),
                              COALESCE(age_min_unit,'años'),
                              COALESCE(lower,-999999),
                              COALESCE(upper,-999999),
                              COALESCE(text_value,''),
                              COALESCE(unit,''),
                              COALESCE(method,'')
                 ORDER BY id
               ) AS rn
        FROM analysis_reference_ranges
      ) t
      WHERE t.rn > 1
    ) d
    WHERE rr.id = d.id;

    -- Índice único natural
    BEGIN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_analysis_reference_ranges_nodup ON analysis_reference_ranges(
        parameter_id,
        COALESCE(sex,''Ambos''),
        COALESCE(age_min,-1),
        COALESCE(age_max,-1),
        COALESCE(age_min_unit,''años''),
        COALESCE(lower,-999999),
        COALESCE(upper,-999999),
        COALESCE(text_value,'''') ,
        COALESCE(unit,''),
        COALESCE(method,'')
      )';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo crear índice único en analysis_reference_ranges: %', SQLERRM;
    END;
  END IF;
END $$;
