-- setup.sql
-- Script maestro idempotente para dejar la base en el ESTADO FINAL requerido.
-- Combina: creación de tablas clave, normalización, constraints, índices, seeds y vistas.
-- Seguro de ejecutar múltiples veces.
-- PostgreSQL / Supabase.
-- Fecha generación: 2025-09-07

BEGIN; -- Transacción principal (algunas operaciones internas usan DO con transacciones propias implícitas)

-- 0. Extensiones necesarias -------------------------------------------------
DO $$
BEGIN
  PERFORM 1 FROM pg_extension WHERE extname='pgcrypto';
  IF NOT FOUND THEN
    BEGIN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgcrypto';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'No privilegios para crear pgcrypto; se asume gen_random_uuid() existente.';
    END;
  END IF;
END$$;

-- 1. Tablas base ------------------------------------------------------------
-- NOTE: Perfiles y system_audit_logs se asumen creadas por Supabase u otras migraciones.

CREATE TABLE IF NOT EXISTS analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text UNIQUE,
  name text NOT NULL,
  category text,
  description text,
  indications text,
  sample_type text,
  sample_container text,
  processing_time_hours int,
  general_units text,
  price numeric(10,2), -- agregado (usado en frontend)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_name ON analysis(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis(category);

CREATE TABLE IF NOT EXISTS analysis_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analysis(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text,
  decimal_places int,
  position int, -- añadida para orden lógico
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reference_ranges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id  uuid NOT NULL REFERENCES analysis_parameters(id) ON DELETE CASCADE,
  sex           text,
  age_min       integer,
  age_max       integer,
  age_min_unit  text,
  lower         numeric,
  upper         numeric,
  text_value    text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- 1.b Tablas adicionales inferidas del código ------------------------------
-- NOTA: Esquemas mínimos / asumidos; ajustar según modelo definitivo.

-- Vista de compatibilidad (frontend usa 'analyses' en algunos puntos)
CREATE OR REPLACE VIEW public.analyses AS SELECT * FROM analysis;

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
  item_id uuid NOT NULL, -- referencia a analysis.id (item_type='analysis')
  item_type text NOT NULL DEFAULT 'analysis',
  created_at timestamptz DEFAULT now(),
  UNIQUE(package_id, item_id, item_type)
);

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  date_of_birth date,
  sex text,
  email text,
  phone_number text,
  address text,
  contact_name text,
  contact_phone text,
  clinical_history text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(LOWER(full_name));

CREATE TABLE IF NOT EXISTS referring_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text,
  specialty text,
  listaprecios jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referring_entities_name ON referring_entities(LOWER(name));
-- Unique lógico case-insensitive para evitar duplicados de nombre
DO $$BEGIN
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='uq_referring_entities_name_ci' AND n.nspname='public';
  IF NOT FOUND THEN
    BEGIN
      CREATE UNIQUE INDEX uq_referring_entities_name_ci ON referring_entities(LOWER(name));
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END$$;

-- Seed del referente "Particular" (usado como cliente genérico) -----------------
INSERT INTO referring_entities (name, entity_type)
SELECT 'Particular','Particular'
WHERE NOT EXISTS (
  SELECT 1 FROM referring_entities WHERE LOWER(name) = 'particular'
);

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  referring_entity_id uuid REFERENCES referring_entities(id) ON DELETE SET NULL,
  -- Nuevo: segundo referente (médico) requerido por el frontend (relación work_orders_referring_doctor_id_fkey)
  referring_doctor_id uuid,
  order_date timestamptz DEFAULT now(),
  status text,
  selected_items jsonb, -- arreglo de items (paquetes / estudios)
  total_price numeric(12,2),
  results_finalized boolean DEFAULT false,
  receipt_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
-- Asegurar columna en instalaciones legacy donde la tabla ya existía sin ella
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS referring_doctor_id uuid;
CREATE INDEX IF NOT EXISTS idx_work_orders_patient ON work_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_referrer ON work_orders(referring_entity_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_referring_doctor ON work_orders(referring_doctor_id);

-- Asegurar FK para referring_doctor_id (idempotente)
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='work_orders_referring_doctor_id_fkey'
  ) THEN
    -- Si la columna no tenía todavía referencia, añadir constraint
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_referring_doctor_id_fkey
      FOREIGN KEY (referring_doctor_id) REFERENCES referring_entities(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS work_order_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  parameter_id uuid REFERENCES analysis_parameters(id) ON DELETE CASCADE,
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
  tax_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION lab_configuration_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_lab_configuration_updated_at') THEN
    CREATE TRIGGER trg_lab_configuration_updated_at BEFORE UPDATE ON lab_configuration
      FOR EACH ROW EXECUTE FUNCTION lab_configuration_set_updated_at();
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  template_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date DEFAULT CURRENT_DATE,
  concept text,
  category text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  method text,
  payment_date timestamptz DEFAULT now(),
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

-- Templates for email campaigns (simple store)
CREATE TABLE IF NOT EXISTS email_campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
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

-- Tabla roles_permissions (nueva estructura agregada: permissions jsonb global por rol)
CREATE TABLE IF NOT EXISTS roles_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Migración de esquema antiguo (columna 'permission' por fila) a nuevo formato jsonb
DO $$BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='roles_permissions' AND column_name='permission'
  ) THEN
    -- Consolidar permisos existentes a jsonb si la nueva columna aún está vacía
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles_permissions' AND column_name='permissions') THEN
      ALTER TABLE roles_permissions ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles_permissions' AND column_name='is_system_role') THEN
      ALTER TABLE roles_permissions ADD COLUMN is_system_role boolean DEFAULT false;
    END IF;
    UPDATE roles_permissions rp
    SET permissions = sub.perms
    FROM (
      SELECT role_name, jsonb_build_object('migrated', jsonb_agg(permission)) AS perms
      FROM roles_permissions
      GROUP BY role_name
    ) sub
    WHERE rp.role_name = sub.role_name AND (rp.permissions IS NULL OR rp.permissions = '{}'::jsonb);
    -- Quitar índices/constraints antiguos si existen
    ALTER TABLE roles_permissions DROP CONSTRAINT IF EXISTS roles_permissions_role_name_permission_key;
    -- Eliminar columna obsoleta
    ALTER TABLE roles_permissions DROP COLUMN permission;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- auth.users.id
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

-- 1.c Tablas núcleo de identidad / auditoría que faltaban ------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY, -- coincide con auth.users.id
  email text UNIQUE,
  first_name text,
  last_name text,
  role text,
  theme text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email_ci ON profiles(LOWER(email));

-- Asegurar columna 'theme' en instalaciones donde profiles ya existía sin ella
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme text;

CREATE TABLE IF NOT EXISTS system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  details jsonb,
  performed_by uuid, -- auth.users.id / profiles.id
  profile_id uuid,
  timestamp timestamptz DEFAULT now()
);

-- FK profile_id (si no existía aún, se garantiza más adelante también)
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_system_audit_logs_profile') THEN
    BEGIN
      ALTER TABLE system_audit_logs
        ADD CONSTRAINT fk_system_audit_logs_profile
        FOREIGN KEY (profile_id) REFERENCES profiles(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

-- Índice para roles_permissions (asegurar tras posible migración)
CREATE INDEX IF NOT EXISTS idx_roles_permissions_role ON roles_permissions(role_name);

-- 1.d Seguridad (RLS) ------------------------------------------------------
-- Activar y crear (si faltan) políticas de acceso en perfiles y auditoría.
-- Nota: Uso de pg_policies para evitar duplicados.

-- Helper para evaluar si el usuario es Administrador sin consultar la misma tabla en la policy (evita recursión)
-- Se basa primero en el claim JWT 'role' (configurable en Supabase). Si no existiera, hace fallback a profiles.
CREATE OR REPLACE FUNCTION current_jwt_role()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE( (current_setting('request.jwt.claims', true)::json ->> 'role') , NULL );
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$
  SELECT (
    COALESCE(current_jwt_role(), (
      SELECT role FROM profiles WHERE id = auth.uid()
    )) = 'Administrador'
  );
$$;

-- RLS en profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Re-crear policies para evitar recursión (si existían, se reemplazan)
DO $$BEGIN
  -- Drop previas que contienen subselect recursivo
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_self_or_admin') THEN
    EXECUTE 'DROP POLICY profiles_select_self_or_admin ON profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_self_or_admin') THEN
    EXECUTE 'DROP POLICY profiles_update_self_or_admin ON profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_insert_self') THEN
    EXECUTE 'DROP POLICY profiles_insert_self ON profiles';
  END IF;

  EXECUTE $pol$CREATE POLICY profiles_select_self_or_admin ON profiles FOR SELECT USING (
    id = auth.uid() OR is_admin()
  )$pol$;

  EXECUTE $pol$CREATE POLICY profiles_insert_self ON profiles FOR INSERT WITH CHECK (
    id = auth.uid()
  )$pol$;

  EXECUTE $pol$CREATE POLICY profiles_update_self_or_admin ON profiles FOR UPDATE USING (
    id = auth.uid() OR is_admin()
  ) WITH CHECK (
    id = auth.uid() OR is_admin()
  )$pol$;
END$$;

-- RLS en system_audit_logs
ALTER TABLE system_audit_logs ENABLE ROW LEVEL SECURITY;
DO $$BEGIN
  -- Drop policies previas con subselect recursivo indirecto
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='system_audit_logs' AND policyname='audit_select_own_or_admin') THEN
    EXECUTE 'DROP POLICY audit_select_own_or_admin ON system_audit_logs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='system_audit_logs' AND policyname='audit_insert_authenticated') THEN
    EXECUTE 'DROP POLICY audit_insert_authenticated ON system_audit_logs';
  END IF;

  EXECUTE $pol$CREATE POLICY audit_select_own_or_admin ON system_audit_logs FOR SELECT USING (
    performed_by = auth.uid() OR is_admin()
  )$pol$;

  EXECUTE $pol$CREATE POLICY audit_insert_authenticated ON system_audit_logs FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND performed_by = auth.uid()
  )$pol$;
END$$;

-- Función helper de permisos (usa role en profiles + roles_permissions.permissions)
CREATE OR REPLACE FUNCTION has_permission(module text, action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles_permissions rp ON rp.role_name = p.role
    WHERE p.id = auth.uid()
      AND rp.permissions ? module
      AND (rp.permissions -> module) ? action
  );
$$;

-- Extensión: columna assigned_to en órdenes para soportar read_assigned
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders(assigned_to);

-- Activar RLS tablas dominio ----------------------------------------------
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE referring_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;

-- Patients policies
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_select') THEN
  EXECUTE $pol$CREATE POLICY patients_select ON patients FOR SELECT USING ( has_permission('patients','read') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_insert') THEN
  EXECUTE $pol$CREATE POLICY patients_insert ON patients FOR INSERT WITH CHECK ( has_permission('patients','create') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_update') THEN
  EXECUTE $pol$CREATE POLICY patients_update ON patients FOR UPDATE USING ( has_permission('patients','update') ) WITH CHECK ( has_permission('patients','update') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_delete') THEN
  EXECUTE $pol$CREATE POLICY patients_delete ON patients FOR DELETE USING ( has_permission('patients','delete') )$pol$; END IF;
END$$;

-- Referring entities
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_select') THEN
  EXECUTE $pol$CREATE POLICY referrers_select ON referring_entities FOR SELECT USING ( has_permission('referrers','read') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_insert') THEN
  EXECUTE $pol$CREATE POLICY referrers_insert ON referring_entities FOR INSERT WITH CHECK ( has_permission('referrers','create') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_update') THEN
  EXECUTE $pol$CREATE POLICY referrers_update ON referring_entities FOR UPDATE USING ( has_permission('referrers','update') ) WITH CHECK ( has_permission('referrers','update') OR has_permission('referrers','manage_pricelists') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_pricelist_update') THEN
  EXECUTE $pol$CREATE POLICY referrers_pricelist_update ON referring_entities FOR UPDATE USING ( has_permission('referrers','manage_pricelists') ) WITH CHECK ( has_permission('referrers','manage_pricelists') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_delete') THEN
  EXECUTE $pol$CREATE POLICY referrers_delete ON referring_entities FOR DELETE USING ( has_permission('referrers','delete') )$pol$; END IF;
END$$;

-- Price list items
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_list_items' AND policyname='price_list_items_select') THEN
  EXECUTE $pol$CREATE POLICY price_list_items_select ON price_list_items FOR SELECT USING ( has_permission('referrers','read') OR has_permission('referrers','manage_pricelists') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_list_items' AND policyname='price_list_items_cud') THEN
  EXECUTE $pol$CREATE POLICY price_list_items_cud ON price_list_items FOR ALL USING ( has_permission('referrers','manage_pricelists') ) WITH CHECK ( has_permission('referrers','manage_pricelists') )$pol$; END IF;
END$$;

-- Analysis (studies)
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis' AND policyname='analysis_select') THEN
  EXECUTE $pol$CREATE POLICY analysis_select ON analysis FOR SELECT USING ( has_permission('studies','read') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis' AND policyname='analysis_insert') THEN
  EXECUTE $pol$CREATE POLICY analysis_insert ON analysis FOR INSERT WITH CHECK ( has_permission('studies','create') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis' AND policyname='analysis_update') THEN
  EXECUTE $pol$CREATE POLICY analysis_update ON analysis FOR UPDATE USING ( has_permission('studies','update') ) WITH CHECK ( has_permission('studies','update') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis' AND policyname='analysis_delete') THEN
  EXECUTE $pol$CREATE POLICY analysis_delete ON analysis FOR DELETE USING ( has_permission('studies','delete') )$pol$; END IF;
END$$;

-- Analysis parameters
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis_parameters' AND policyname='analysis_parameters_select') THEN
  EXECUTE $pol$CREATE POLICY analysis_parameters_select ON analysis_parameters FOR SELECT USING ( has_permission('studies','read') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis_parameters' AND policyname='analysis_parameters_cud') THEN
  EXECUTE $pol$CREATE POLICY analysis_parameters_cud ON analysis_parameters FOR ALL USING ( has_permission('studies','update') OR has_permission('studies','create') OR has_permission('studies','delete') ) WITH CHECK ( has_permission('studies','update') OR has_permission('studies','create') )$pol$; END IF;
END$$;

-- Reference ranges
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reference_ranges' AND policyname='reference_ranges_select') THEN
  EXECUTE $pol$CREATE POLICY reference_ranges_select ON reference_ranges FOR SELECT USING ( has_permission('studies','read') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reference_ranges' AND policyname='reference_ranges_cud') THEN
  EXECUTE $pol$CREATE POLICY reference_ranges_cud ON reference_ranges FOR ALL USING ( has_permission('studies','update') ) WITH CHECK ( has_permission('studies','update') )$pol$; END IF;
END$$;

-- Packages
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis_packages' AND policyname='packages_select') THEN
  EXECUTE $pol$CREATE POLICY packages_select ON analysis_packages FOR SELECT USING ( has_permission('packages','read') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis_packages' AND policyname='packages_cud') THEN
  EXECUTE $pol$CREATE POLICY packages_cud ON analysis_packages FOR ALL USING ( has_permission('packages','update') OR has_permission('packages','create') OR has_permission('packages','delete') ) WITH CHECK ( has_permission('packages','update') OR has_permission('packages','create') )$pol$; END IF;
END$$;

-- Package items
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis_package_items' AND policyname='package_items_select') THEN
  EXECUTE $pol$CREATE POLICY package_items_select ON analysis_package_items FOR SELECT USING ( has_permission('packages','read') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis_package_items' AND policyname='package_items_cud') THEN
  EXECUTE $pol$CREATE POLICY package_items_cud ON analysis_package_items FOR ALL USING ( has_permission('packages','update') OR has_permission('packages','create') ) WITH CHECK ( has_permission('packages','update') OR has_permission('packages','create') )$pol$; END IF;
END$$;

-- Work orders
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_orders' AND policyname='work_orders_select') THEN
  EXECUTE $pol$CREATE POLICY work_orders_select ON work_orders FOR SELECT USING (
      has_permission('orders','read_all') OR (
        has_permission('orders','read_assigned') AND assigned_to = auth.uid()
      )
  )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_orders' AND policyname='work_orders_insert') THEN
  EXECUTE $pol$CREATE POLICY work_orders_insert ON work_orders FOR INSERT WITH CHECK ( has_permission('orders','create') )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_orders' AND policyname='work_orders_update_status_results') THEN
  EXECUTE $pol$CREATE POLICY work_orders_update_status_results ON work_orders FOR UPDATE USING (
      has_permission('orders','update_status') OR has_permission('orders','enter_results') OR has_permission('orders','validate_results')
    ) WITH CHECK (
      has_permission('orders','update_status') OR has_permission('orders','enter_results') OR has_permission('orders','validate_results')
  )$pol$; END IF;
END$$;

-- Work order results
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_order_results' AND policyname='work_order_results_select') THEN
  EXECUTE $pol$CREATE POLICY work_order_results_select ON work_order_results FOR SELECT USING (
      has_permission('orders','read_all') OR has_permission('orders','enter_results') OR has_permission('orders','validate_results')
  )$pol$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_order_results' AND policyname='work_order_results_cud') THEN
  EXECUTE $pol$CREATE POLICY work_order_results_cud ON work_order_results FOR ALL USING (
      has_permission('orders','enter_results') OR has_permission('orders','validate_results')
    ) WITH CHECK (
      has_permission('orders','enter_results') OR has_permission('orders','validate_results')
  )$pol$; END IF;
END$$;

-- 2. Limpieza de duplicados (conserva primera fila por grupo) ---------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reference_ranges' AND table_schema='public') THEN
    DELETE FROM reference_ranges r USING (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY parameter_id,
                            COALESCE(LOWER(sex),'Ambos'),
                            COALESCE(age_min,-1),
                            COALESCE(age_max,-1),
                            COALESCE(age_min_unit,'años'),
                            COALESCE(lower,-1),
                            COALESCE(upper,-1),
                            COALESCE(text_value,'')
               ORDER BY id
             ) rn
      FROM reference_ranges
    ) d
    WHERE r.id=d.id AND d.rn>1;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='analysis_parameters' AND table_schema='public') THEN
    DELETE FROM analysis_parameters ap USING (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY analysis_id, LOWER(name) ORDER BY id) rn
      FROM analysis_parameters
    ) d
    WHERE ap.id=d.id AND d.rn>1;
  END IF;
END$$;

-- 3. Normalización analysis_parameters -------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='analysis_parameters' AND table_schema='public') THEN
    UPDATE analysis_parameters SET name=NULLIF(TRIM(name),''), unit=NULLIF(TRIM(unit),'');
    UPDATE analysis_parameters SET decimal_places=NULL WHERE decimal_places IS NOT NULL AND decimal_places<0;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_analysis_parameters_decimal_places') THEN
      BEGIN
        ALTER TABLE analysis_parameters ADD CONSTRAINT chk_analysis_parameters_decimal_places CHECK (decimal_places IS NULL OR decimal_places >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
  END IF;
END$$;

-- Posiciones (relleno inicial si vienen NULL)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY analysis_id ORDER BY created_at, name) rn
  FROM analysis_parameters WHERE position IS NULL
)
UPDATE analysis_parameters ap SET position=o.rn FROM ordered o WHERE ap.id=o.id;

-- 4. Normalización reference_ranges ----------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reference_ranges' AND table_schema='public') THEN
    UPDATE reference_ranges
      SET sex = CASE
        WHEN sex ILIKE 'masc%' THEN 'Masculino'
        WHEN sex ILIKE 'fem%' THEN 'Femenino'
        WHEN sex IS NULL OR TRIM(sex)='' OR sex ILIKE 'amb%' THEN 'Ambos'
        ELSE INITCAP(LOWER(sex)) END;
    UPDATE reference_ranges
      SET age_min_unit = CASE
        WHEN age_min_unit IS NULL OR TRIM(age_min_unit)='' THEN 'años'
        WHEN lower(age_min_unit) IN ('dia','d','day','days','dias') THEN 'días'
        WHEN lower(age_min_unit) IN ('mes','month','months','m') THEN 'meses'
        WHEN lower(age_min_unit) IN ('ano','anos','año','años','year','years','y') THEN 'años'
        WHEN lower(age_min_unit) IN ('días','meses','años') THEN age_min_unit
        ELSE 'años' END;
    UPDATE reference_ranges SET age_min_unit='días' WHERE age_min_unit='dias';
    UPDATE reference_ranges SET age_min_unit='años' WHERE age_min_unit IN ('anos','ano','año');
  END IF;
END$$;

-- 5. Constraints finales ----------------------------------------------------
-- reference_ranges.sex
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS reference_ranges_sex_check;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_sex;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_sex_v2;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_reference_ranges_sex_v2') THEN
    ALTER TABLE reference_ranges ADD CONSTRAINT chk_reference_ranges_sex_v2 CHECK (sex IN ('Ambos','Masculino','Femenino'));
  END IF;
END$$;

-- reference_ranges.age_min_unit
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS reference_ranges_age_min_unit_check;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_age_unit;
ALTER TABLE reference_ranges DROP CONSTRAINT IF EXISTS chk_reference_ranges_age_unit_v2;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_reference_ranges_age_unit_v2') THEN
    ALTER TABLE reference_ranges ADD CONSTRAINT chk_reference_ranges_age_unit_v2 CHECK (age_min_unit IN ('días','meses','años'));
  END IF;
END$$;

-- 6. Índices ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_analysis_parameters_analysis_id ON analysis_parameters(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_parameters_analysis_id_position ON analysis_parameters(analysis_id, position);
DO $$
BEGIN
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relname='uq_analysis_parameters_analysis_name' AND n.nspname='public';
  IF NOT FOUND THEN
    BEGIN
      CREATE UNIQUE INDEX uq_analysis_parameters_analysis_name ON analysis_parameters(analysis_id, LOWER(name));
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_reference_ranges_parameter_id ON reference_ranges(parameter_id);
DO $$
BEGIN
  PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relname='uq_reference_ranges_nodup' AND n.nspname='public';
  IF NOT FOUND THEN
    BEGIN
      CREATE UNIQUE INDEX uq_reference_ranges_nodup ON reference_ranges(
        parameter_id,
        COALESCE(sex,'Ambos'),
        COALESCE(age_min,-1),
        COALESCE(age_max,-1),
        COALESCE(age_min_unit,'años'),
        COALESCE(lower,-1),
        COALESCE(upper,-1),
        COALESCE(text_value,'')
      );
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END$$;

-- Índice único email case-insensitive en profiles (si existe la tabla & columna)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
    PERFORM 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='uq_profiles_email_ci' AND n.nspname='public';
    IF NOT FOUND THEN
      BEGIN
        CREATE UNIQUE INDEX uq_profiles_email_ci ON profiles(LOWER(email));
      EXCEPTION WHEN duplicate_table THEN NULL; END;
    END IF;
  END IF;
END$$;

-- 7. Tabla roles y seeds ----------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text UNIQUE NOT NULL,
  label text NOT NULL,
  color_class text NOT NULL
);

-- Insertar roles por upsert seguro
INSERT INTO roles (role_name, label, color_class)
VALUES
  ('Administrador','Administrador','bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'),
  ('Recepcionista','Recepcionista','bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300'),
  ('Laboratorista','Laboratorista','bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300')
ON CONFLICT (role_name) DO UPDATE SET
  label = EXCLUDED.label,
  color_class = EXCLUDED.color_class;

-- Seed roles_permissions si vacío
DO $$
DECLARE cnt int; BEGIN
  SELECT COUNT(*) INTO cnt FROM roles_permissions;
  IF cnt = 0 THEN
    INSERT INTO roles_permissions (role_name, permissions, is_system_role)
    VALUES
      ('Administrador', jsonb_build_object(
        'patients', ARRAY['create','read','update','delete'],
        'referrers', ARRAY['create','read','update','delete','manage_pricelists'],
        'studies', ARRAY['create','read','update','delete'],
        'packages', ARRAY['create','read','update','delete'],
        'orders', ARRAY['create','read_all','read_assigned','update_status','enter_results','validate_results','print_report','send_report'],
        'finance', ARRAY['access_income_report','access_expense_tracking','manage_expenses','access_accounts_receivable','manage_payments','access_invoicing'],
        'administration', ARRAY['manage_users','manage_roles','system_settings','view_audit_log','manage_templates','manage_branches'],
        'settings', ARRAY['access_settings','change_theme'],
        'marketing', ARRAY['access_marketing_tools','manage_campaigns','manage_social_media','manage_email_marketing','manage_seo_content','view_marketing_analytics','manage_loyalty_programs']
      ), true),
      ('Técnico de Laboratorio', jsonb_build_object(
        'patients', ARRAY['read'],
        'orders', ARRAY['read_assigned','enter_results','update_status']
      ), true),
      ('Recepcionista', jsonb_build_object(
        'patients', ARRAY['create','read','update'],
        'referrers', ARRAY['read'],
        'studies', ARRAY['read'],
        'packages', ARRAY['read'],
        'orders', ARRAY['create','read_all','update_status','print_report','send_report'],
        'finance', ARRAY['access_accounts_receivable','manage_payments']
      ), true),
      ('Flebotomista', jsonb_build_object(
        'patients', ARRAY['read'],
        'orders', ARRAY['read_assigned','update_status']
      ), true),
      ('Invitado', '{}'::jsonb, true);
  END IF;
END$$;

DO $$
DECLARE
  ts_col text;
  view_sql text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_audit_logs') THEN
    -- Columna profile_id
    BEGIN
      ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS profile_id uuid;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    -- Backfill básico (solo donde esté NULL) y solo si existe el perfil para evitar violar FK ya creado
    UPDATE public.system_audit_logs AS sal
    SET profile_id = sal.performed_by
    FROM public.profiles p
    WHERE sal.profile_id IS NULL
      AND sal.performed_by IS NOT NULL
      AND p.id = sal.performed_by;
    -- Constraint FK si no existe
    PERFORM 1 FROM pg_constraint WHERE conname='fk_system_audit_logs_profile';
    IF NOT FOUND THEN
      BEGIN
        ALTER TABLE public.system_audit_logs
          ADD CONSTRAINT fk_system_audit_logs_profile
          FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
          ON UPDATE CASCADE ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
    -- Vista (crea / reemplaza si profiles existe)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
      -- Detectar columna de tiempo disponible en system_audit_logs (timestamp/created_at/etc.)
      SELECT column_name INTO ts_col
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='system_audit_logs'
        AND column_name IN ('timestamp','created_at','logged_at','event_time','event_at','ts')
      ORDER BY CASE
        WHEN column_name='timestamp' THEN 1
        WHEN column_name='created_at' THEN 2
        ELSE 3
      END
      LIMIT 1;

      IF ts_col IS NULL THEN
        -- Fallback: si no se detecta ninguna, usar created_at si existe sin estar en la lista anterior
        SELECT column_name INTO ts_col
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='system_audit_logs' AND column_name='created_at'
        LIMIT 1;
      END IF;

      IF ts_col IS NULL THEN
        -- Si aun así no existe ninguna columna temporal, no crear/actualizar la vista para evitar error
        RAISE NOTICE 'No se encontró columna temporal en system_audit_logs; se omite la creación de la vista.';
      ELSE
        -- Construir SQL de la vista mapeando la columna detectada como "timestamp"
        view_sql := format($fmt$
          CREATE OR REPLACE VIEW public.vw_system_audit_logs AS
          SELECT
            sal.id,
            sal.action AS event_type,
            sal.details,
            sal.performed_by AS user_id,
            sal.profile_id,
            p.first_name,
            p.last_name,
            sal.%1$I AS "timestamp"
          FROM public.system_audit_logs sal
          LEFT JOIN public.profiles p ON p.id = sal.profile_id
          ORDER BY sal.%1$I DESC
        $fmt$, ts_col);
        EXECUTE view_sql;
      END IF;
    END IF;
  END IF;
END$$;

-- 9. Sembrar profiles desde auth.users (si existen ambas tablas) ------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    INSERT INTO profiles (id, email, first_name, last_name, role)
    SELECT u.id,
           u.email,
           u.raw_user_meta_data->>'first_name',
           u.raw_user_meta_data->>'last_name',
           COALESCE(u.raw_user_meta_data->>'role', u.raw_app_meta_data->>'role','')
    FROM auth.users u
    ON CONFLICT (id) DO NOTHING;
  END IF;
END$$;

COMMIT; -- Fin transacción principal

-- 10. Verificaciones (NOTICES) ---------------------------------------------
DO $$
DECLARE ref_exists boolean; param_exists boolean; BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reference_ranges') INTO ref_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='analysis_parameters') INTO param_exists;
  IF param_exists THEN RAISE NOTICE 'analysis_parameters total=%',(SELECT COUNT(*) FROM analysis_parameters); END IF;
  IF ref_exists THEN
    RAISE NOTICE 'reference_ranges total=%',(SELECT COUNT(*) FROM reference_ranges);
    RAISE NOTICE 'sex distinct=%',(SELECT array_agg(DISTINCT sex) FROM reference_ranges);
    RAISE NOTICE 'age_min_unit distinct=%',(SELECT array_agg(DISTINCT age_min_unit) FROM reference_ranges);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='roles') THEN
    RAISE NOTICE 'roles total=%',(SELECT COUNT(*) FROM roles);
  END IF;
END$$;

-- 11. Notas de rollback rápido ---------------------------------------------
-- * Eliminar constraints añadidos: ver nombres chk_* y fk_system_audit_logs_profile
-- * Eliminar índices: uq_reference_ranges_nodup, idx_reference_ranges_parameter_id, uq_analysis_parameters_analysis_name, idx_analysis_parameters_analysis_id, idx_analysis_parameters_analysis_id_position
-- * No se eliminan tablas automáticamente.

-- FIN setup.sql
