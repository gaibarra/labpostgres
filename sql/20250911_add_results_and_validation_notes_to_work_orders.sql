-- Add results (jsonb) and validation_notes (text) columns to work_orders if missing
-- Date: 2025-09-11
-- Idempotent migration

BEGIN;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS results jsonb,
  ADD COLUMN IF NOT EXISTS validation_notes text;

COMMIT;
