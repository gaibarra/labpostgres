-- Ensure schema_migrations supports ON CONFLICT by enforcing filename uniqueness
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id serial PRIMARY KEY,
  filename text UNIQUE NOT NULL,
  checksum text,
  executed_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schema_migrations_filename_key'
  ) THEN
    BEGIN
      ALTER TABLE schema_migrations
        ADD CONSTRAINT schema_migrations_filename_key UNIQUE (filename);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

COMMIT;
