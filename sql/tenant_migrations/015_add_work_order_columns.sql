-- Align tenant work_orders schema with core app requirements
-- Adds institution_reference, results and validation_notes if missing
-- Date: 2025-11-17

BEGIN;

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS institution_reference text,
  ADD COLUMN IF NOT EXISTS results jsonb,
  ADD COLUMN IF NOT EXISTS validation_notes text;

COMMIT;
