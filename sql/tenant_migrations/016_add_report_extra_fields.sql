-- Add optional extra report fields to work_orders for tenants
-- Fields: report_extra_description, report_extra_diagnosis, report_extra_notes
-- Date: 2025-12-18

BEGIN;

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS report_extra_description text,
  ADD COLUMN IF NOT EXISTS report_extra_diagnosis text,
  ADD COLUMN IF NOT EXISTS report_extra_notes text;

COMMIT;
