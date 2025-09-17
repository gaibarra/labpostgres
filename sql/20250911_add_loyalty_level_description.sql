-- Adds description column for loyalty program levels if missing
ALTER TABLE loyalty_program_levels
  ADD COLUMN IF NOT EXISTS description text;

-- No-op comment for idempotency verification
-- SELECT 'description column ensured for loyalty_program_levels';