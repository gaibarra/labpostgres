-- Add pricing / financial fields to work_orders if missing
-- Date: 2025-09-11
-- Idempotent migration

BEGIN;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS descuento numeric(12,2),
  ADD COLUMN IF NOT EXISTS anticipo numeric(12,2),
  ADD COLUMN IF NOT EXISTS notas text; -- saldoPendiente is derived client-side

COMMIT;
