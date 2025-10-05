-- Migration: add work_order_id and notes to payments (legacy tenants without the column)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes text;
-- Optional backfill: If payments previously linked only to patient, leave work_order_id null.
