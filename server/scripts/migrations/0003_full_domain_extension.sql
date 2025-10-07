-- 0003_full_domain_extension.sql
-- Extiende el dominio para que un tenant nuevo quede con TODAS las tablas funcionales
-- Partes extraídas y adaptadas de sql/setup.sql (idempotente) evitando redefinir tablas ya creadas.
-- Objetivos:
--  * Alinear tablas existentes (work_orders, referrers -> referring_entities)
--  * Crear tablas faltantes (paquetes, marketing, loyalty, security, etc.)
--  * Añadir columnas necesarias para que el frontend y futuras políticas funcionen
--  * Mantener idempotencia (IF NOT EXISTS / comprobaciones)

BEGIN;

-- 1. Renombrar referrers a referring_entities si aplica
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referrers' AND table_schema='public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referring_entities' AND table_schema='public') THEN
    ALTER TABLE referrers RENAME TO referring_entities;
  END IF;
END$$;

-- 2. Ajustar columnas de referring_entities
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referring_entities') THEN
    -- specialty
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='referring_entities' AND column_name='specialty'
    ) THEN
      ALTER TABLE referring_entities ADD COLUMN specialty text;
    END IF;
    -- listaprecios jsonb
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='referring_entities' AND column_name='listaprecios'
    ) THEN
      ALTER TABLE referring_entities ADD COLUMN listaprecios jsonb;
    END IF;
    -- índice nombre ci
    PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relname='uq_referring_entities_name_ci' AND n.nspname='public';
    IF NOT FOUND THEN
      BEGIN
        CREATE UNIQUE INDEX uq_referring_entities_name_ci ON referring_entities(LOWER(name));
      EXCEPTION WHEN duplicate_table THEN NULL; END;
    END IF;
  END IF;
END$$;

-- Seed del referente Particular (genérico) si no existe
INSERT INTO referring_entities (name, entity_type)
SELECT 'Particular','Particular'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referring_entities')
  AND NOT EXISTS (SELECT 1 FROM referring_entities WHERE LOWER(name)='particular');

-- 3. Extender work_orders con columnas finales
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='work_orders') THEN
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='folio';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN folio text; END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='referring_entity_id';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN referring_entity_id uuid REFERENCES referring_entities(id) ON DELETE SET NULL; END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='referring_doctor_id';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN referring_doctor_id uuid; END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='order_date';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN order_date timestamptz DEFAULT now(); END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='selected_items';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN selected_items jsonb; END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='total_price';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN total_price numeric(12,2); END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='results_finalized';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN results_finalized boolean DEFAULT false; END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='receipt_generated';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN receipt_generated boolean DEFAULT false; END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='assigned_to';
    IF NOT FOUND THEN ALTER TABLE work_orders ADD COLUMN assigned_to uuid; END IF;
    -- Índices complementarios
    CREATE INDEX IF NOT EXISTS idx_work_orders_referring_entity ON work_orders(referring_entity_id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_referring_doctor ON work_orders(referring_doctor_id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders(assigned_to);
  END IF;
END$$;

-- 4. Tablas faltantes (no creadas en 0001/0002) ---------------------------
CREATE TABLE IF NOT EXISTS analysis_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES analysis_packages(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  item_type text NOT NULL DEFAULT 'analysis',
  created_at timestamptz DEFAULT now(),
  UNIQUE(package_id, item_id, item_type)
);

CREATE TABLE IF NOT EXISTS work_order_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  parameter_id uuid,
  value_numeric numeric,
  value_text text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_order_results_order ON work_order_results(work_order_id);

CREATE TABLE IF NOT EXISTS price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES referring_entities(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES analysis(id) ON DELETE CASCADE,
  custom_price numeric(10,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(referrer_id, analysis_id)
);

CREATE TABLE IF NOT EXISTS lab_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_info jsonb DEFAULT '{}'::jsonb,
  report_settings jsonb DEFAULT '{}'::jsonb,
  ui_settings jsonb DEFAULT '{}'::jsonb,
  regional_settings jsonb DEFAULT '{}'::jsonb,
  integrations_settings jsonb DEFAULT '{}'::jsonb,
  integrations_meta jsonb DEFAULT '{}'::jsonb,
  tax_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION lab_configuration_set_updated_at()
RETURNS trigger AS $$BEGIN NEW.updated_at = now(); RETURN NEW; END;$$ LANGUAGE plpgsql;
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_lab_configuration_updated_at') THEN
    CREATE TRIGGER trg_lab_configuration_updated_at BEFORE UPDATE ON lab_configuration
      FOR EACH ROW EXECUTE FUNCTION lab_configuration_set_updated_at();
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date DEFAULT CURRENT_DATE,
  concept text,
  category text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  provider text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  method text,
  payment_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text DEFAULT 'Activa',
  budget numeric(12,2),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text,
  content text,
  status text DEFAULT 'Borrador',
  engagement jsonb,
  publish_date_time timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  subject text,
  body text,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  guide text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS web_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  status text,
  body text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS loyalty_program_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  threshold int,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS loyalty_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  current_level_id uuid REFERENCES loyalty_program_levels(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  status text DEFAULT 'Activo',
  created_at timestamptz DEFAULT now(),
  UNIQUE(email)
);

CREATE TABLE IF NOT EXISTS email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name)
);
CREATE TABLE IF NOT EXISTS email_list_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES email_lists(id) ON DELETE CASCADE,
  subscriber_id uuid REFERENCES subscribers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(list_id, subscriber_id)
);

CREATE TABLE IF NOT EXISTS roles_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roles_permissions_role ON roles_permissions(role_name);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role text,
  is_owner boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, org_id)
);

CREATE TABLE IF NOT EXISTS lab_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text,
  url text,
  created_at timestamptz DEFAULT now()
);

-- Parámetros del sistema (config clave/valor extendida)
CREATE TABLE IF NOT EXISTS system_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  first_name text,
  last_name text,
  role text,
  theme text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email_ci ON profiles(LOWER(email));

CREATE TABLE IF NOT EXISTS system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  details jsonb,
  performed_by uuid,
  profile_id uuid,
  timestamp timestamptz DEFAULT now()
);
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_system_audit_logs_profile') THEN
    ALTER TABLE system_audit_logs
      ADD CONSTRAINT fk_system_audit_logs_profile FOREIGN KEY (profile_id) REFERENCES profiles(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text UNIQUE NOT NULL,
  label text NOT NULL,
  color_class text NOT NULL
);

COMMIT;
