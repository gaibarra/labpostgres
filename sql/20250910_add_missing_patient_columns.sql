-- Add missing optional columns to patients and reload PostgREST schema cache
-- Safe to run multiple times (IF NOT EXISTS)

BEGIN;

ALTER TABLE IF EXISTS public.patients
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS clinical_history text;

-- Ask PostgREST to refresh its schema cache so new columns are visible immediately
-- This is harmless if PostgREST isn’t present.
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN undefined_object THEN
  -- ignore if pgrst channel is not available (e.g., local psql without PostgREST)
  NULL;
END$$;

COMMIT;
