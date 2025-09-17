-- Add missing fields to email_campaigns for full persistence of UI data
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='email_campaigns' AND column_name='list_id'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN list_id uuid REFERENCES email_lists(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='email_campaigns' AND column_name='template_id'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN template_id uuid REFERENCES templates(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='email_campaigns' AND column_name='send_date_time'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN send_date_time timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='email_campaigns' AND column_name='metrics'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN metrics jsonb DEFAULT '{}'::jsonb;
  END IF;
END$$;
