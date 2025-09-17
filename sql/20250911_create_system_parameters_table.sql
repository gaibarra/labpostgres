-- Creates system_parameters key/value table if not exists
CREATE TABLE IF NOT EXISTS system_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger to auto update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_system_parameters_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION fn_system_parameters_set_updated_at()
    RETURNS trigger AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_system_parameters_updated_at
      BEFORE UPDATE ON system_parameters
      FOR EACH ROW
      EXECUTE FUNCTION fn_system_parameters_set_updated_at();
  END IF;
END $$;
