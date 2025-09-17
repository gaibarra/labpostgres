-- Add price column to analysis table if missing (align with API expectations)
-- Date: 2025-09-11
-- Idempotent: uses IF NOT EXISTS

BEGIN;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS price numeric(10,2);
COMMIT;
