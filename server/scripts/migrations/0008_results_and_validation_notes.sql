-- 0008_results_and_validation_notes.sql
-- Asegura columnas results (jsonb) y validation_notes (text) en work_orders para todos los tenants.
-- Idempotente.

BEGIN;

DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='work_orders') THEN
    -- results jsonb
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='work_orders' AND column_name='results'
    ) THEN
      ALTER TABLE work_orders ADD COLUMN results jsonb;
    END IF;

    -- validation_notes text
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='work_orders' AND column_name='validation_notes'
    ) THEN
      ALTER TABLE work_orders ADD COLUMN validation_notes text;
    END IF;
  END IF;
END$$;

COMMIT;
