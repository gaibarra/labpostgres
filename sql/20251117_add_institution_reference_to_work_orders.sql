-- Ensure work_orders has modern result fields
-- Date: 2025-11-17
-- Idempotent migration to align schema with API expectations

BEGIN;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS institution_reference text,
  ADD COLUMN IF NOT EXISTS results jsonb,
  ADD COLUMN IF NOT EXISTS validation_notes text;

COMMIT;
