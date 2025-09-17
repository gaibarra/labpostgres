-- Ensure all expected work_orders columns exist (idempotent consolidation)
-- Date: 2025-09-12
-- This script can be run safely multiple times.
-- It merges prior incremental migrations so new environments only need setup.sql + this file.

BEGIN;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS descuento numeric(12,2),
  ADD COLUMN IF NOT EXISTS anticipo numeric(12,2),
  ADD COLUMN IF NOT EXISTS notas text,
  ADD COLUMN IF NOT EXISTS results jsonb,
  ADD COLUMN IF NOT EXISTS validation_notes text;

COMMIT;

-- Verification query suggestion (run manually):
-- SELECT column_name FROM information_schema.columns WHERE table_name='work_orders' ORDER BY 1;
