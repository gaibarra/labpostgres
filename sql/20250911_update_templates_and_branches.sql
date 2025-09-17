-- Align templates & branches schema with frontend expectations (idempotent)
DO $$ BEGIN
  -- Templates extra columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='type') THEN
    ALTER TABLE templates ADD COLUMN type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='content') THEN
    ALTER TABLE templates ADD COLUMN content text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='header') THEN
    ALTER TABLE templates ADD COLUMN header text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='footer') THEN
    ALTER TABLE templates ADD COLUMN footer text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='is_default') THEN
    ALTER TABLE templates ADD COLUMN is_default boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='is_system') THEN
    ALTER TABLE templates ADD COLUMN is_system boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='updated_at') THEN
    ALTER TABLE templates ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
  -- Branches extra columns
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='city';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN city text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='state';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN state text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='zip_code';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN zip_code text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='country';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN country text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='phone';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN phone text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='email';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN email text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='manager_name';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN manager_name text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='operating_hours';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN operating_hours text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='folio_prefix';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN folio_prefix text; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='is_main';
  IF NOT FOUND THEN ALTER TABLE branches ADD COLUMN is_main boolean DEFAULT false; END IF;
END $$;

-- Trigger for templates updated_at
CREATE OR REPLACE FUNCTION templates_set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_templates_updated_at') THEN
    CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION templates_set_updated_at();
  END IF;
END $$;