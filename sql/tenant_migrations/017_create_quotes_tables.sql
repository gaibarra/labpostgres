-- Tenant migration: quotes module + referrer contact fields
BEGIN;

ALTER TABLE referring_entities
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS social_media JSONB;

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text,
  referring_entity_id uuid REFERENCES referring_entities(id) ON DELETE SET NULL,
  status text DEFAULT 'Borrador',
  quote_date timestamptz DEFAULT now(),
  expires_at timestamptz,
  subtotal numeric(12,2) DEFAULT 0,
  descuento numeric(12,2) DEFAULT 0,
  descuento_percent numeric(5,2) DEFAULT 0,
  total_price numeric(12,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_referrer ON quotes(referring_entity_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes(quote_date);

CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  item_name text,
  base_price numeric(10,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  final_price numeric(10,2) DEFAULT 0,
  position int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_item ON quote_items(item_id);

CREATE TABLE IF NOT EXISTS quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  status text,
  snapshot jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(quote_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_quote_versions_quote ON quote_versions(quote_id);

CREATE TABLE IF NOT EXISTS quote_version_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_version_id uuid NOT NULL REFERENCES quote_versions(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid,
  item_name text,
  base_price numeric(10,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  final_price numeric(10,2) DEFAULT 0,
  position int
);
CREATE INDEX IF NOT EXISTS idx_quote_version_items_version ON quote_version_items(quote_version_id);

CREATE OR REPLACE FUNCTION quotes_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_quotes_updated_at') THEN
    CREATE TRIGGER trg_quotes_updated_at BEFORE UPDATE ON quotes
      FOR EACH ROW EXECUTE FUNCTION quotes_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_quote_items_updated_at') THEN
    CREATE TRIGGER trg_quote_items_updated_at BEFORE UPDATE ON quote_items
      FOR EACH ROW EXECUTE FUNCTION quotes_set_updated_at();
  END IF;
END$$;

COMMIT;
