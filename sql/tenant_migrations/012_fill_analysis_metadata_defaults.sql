-- 012_fill_analysis_metadata_defaults.sql
-- Rellena metadatos faltantes en `analysis` con valores por defecto sensatos.
-- Idempotente y seguro: sólo escribe cuando los campos están NULL o vacíos.

BEGIN;

-- Asegurar columnas (por si algún tenant quedó desfasado)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analysis') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='description') THEN
      ALTER TABLE analysis ADD COLUMN description text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='indications') THEN
      ALTER TABLE analysis ADD COLUMN indications text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='sample_type') THEN
      ALTER TABLE analysis ADD COLUMN sample_type text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='sample_container') THEN
      ALTER TABLE analysis ADD COLUMN sample_container text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='processing_time_hours') THEN
      ALTER TABLE analysis ADD COLUMN processing_time_hours integer;
    END IF;
  END IF;
END$$;

-- Normalización: tratar strings vacíos como NULL para completar valores
UPDATE analysis SET
  description = NULLIF(TRIM(description), ''),
  indications = NULLIF(TRIM(indications), ''),
  sample_type = NULLIF(TRIM(sample_type), ''),
  sample_container = NULLIF(TRIM(sample_container), '')
WHERE TRUE;

-- Defaults generales para cualquier estudio sin metadatos
UPDATE analysis SET 
  description = COALESCE(description, 'Estudio de laboratorio clínico.'),
  indications = COALESCE(indications, 'Según criterio clínico y sospecha diagnóstica.'),
  sample_type = COALESCE(sample_type, 'Suero'),
  sample_container = COALESCE(sample_container, 'Tubo rojo o amarillo (SST)'),
  processing_time_hours = COALESCE(processing_time_hours, 8);

-- Afinar por categorías conocidas si la columna existe y la categoría sugiere otro tipo de muestra
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='category') THEN
    -- Orina
    UPDATE analysis SET sample_type = 'Orina', sample_container = 'Vaso estéril de orina'
    WHERE LOWER(COALESCE(category,'')) ~ 'orina' AND sample_type IS NULL;
    -- Hematología
    UPDATE analysis SET sample_type = 'Sangre total', sample_container = 'Tubo morado (EDTA)'
    WHERE LOWER(COALESCE(category,'')) ~ 'hema' AND sample_type IS NULL;
    -- Gases/sangre capilar/arterial (keywords)
    UPDATE analysis SET sample_type = 'Sangre arterial o venosa', sample_container = 'Jeringa heparinizada o tubo heparina'
    WHERE LOWER(COALESCE(category,'')) ~ 'gaso' AND sample_type IS NULL;
  END IF;
END$$;

COMMIT;
