-- 0007_analysis_add_metadata.sql
-- Agrega columnas de metadatos clínicos a la tabla moderna `analysis`.
-- Campos: description, indications, sample_type, sample_container,
--         processing_time_hours, general_units
-- Idempotente: sólo añade columnas que no existan.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analysis') THEN
    -- description
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='description'
    ) THEN
      ALTER TABLE analysis ADD COLUMN description text;
    END IF;
    -- indications
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='indications'
    ) THEN
      ALTER TABLE analysis ADD COLUMN indications text;
    END IF;
    -- sample_type
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='sample_type'
    ) THEN
      ALTER TABLE analysis ADD COLUMN sample_type text;
    END IF;
    -- sample_container
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='sample_container'
    ) THEN
      ALTER TABLE analysis ADD COLUMN sample_container text;
    END IF;
    -- processing_time_hours
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='processing_time_hours'
    ) THEN
      ALTER TABLE analysis ADD COLUMN processing_time_hours integer;
    END IF;
    -- general_units (unidad genérica para reportes cuando un parámetro no tiene unit)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='analysis' AND column_name='general_units'
    ) THEN
      ALTER TABLE analysis ADD COLUMN general_units text;
    END IF;
  END IF;
END$$;

COMMIT;
