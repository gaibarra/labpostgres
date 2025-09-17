-- Adds contact fields to referring_entities and supporting indexes
BEGIN;

ALTER TABLE referring_entities
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Optional but useful for case-insensitive lookups by email
CREATE INDEX IF NOT EXISTS idx_referring_entities_email_ci ON referring_entities ((LOWER(email)));

COMMIT;