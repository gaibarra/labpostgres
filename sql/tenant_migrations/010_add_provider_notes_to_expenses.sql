-- Migration: add provider and notes columns to expenses
-- Safe for re-run; uses IF NOT EXISTS

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes text;

-- Optional: backfill notes/provider from concept if needed (example commented)
-- UPDATE public.expenses SET provider = 'N/D' WHERE provider IS NULL;
