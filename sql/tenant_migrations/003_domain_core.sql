-- 003_domain_core.sql
-- Tablas núcleo de dominio para cada tenant.
-- Incluye: patients, analysis, analysis_parameters, reference_ranges,
-- work_orders, work_order_items, branches, referrers, packages, templates (básicas).
-- Idempotente (IF NOT EXISTS) y llaves foráneas con ON DELETE CASCADE donde aplica.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- PATIENTS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  first_name text,
  last_name text,
  full_name text GENERATED ALWAYS AS (COALESCE(first_name,'') || CASE WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN ' ' ELSE '' END || COALESCE(last_name,'')) STORED,
  date_of_birth date,
  sex text CHECK (sex IN ('M','F','O') OR sex IS NULL),
  document_number text,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Índice trigram para búsquedas por nombre (requiere pg_trgm)
CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm ON patients USING gin (full_name gin_trgm_ops) WHERE full_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_document ON patients(document_number);

-- ANALYSIS (catálogo de estudios) ---------------------------------
CREATE TABLE IF NOT EXISTS analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text,
  price numeric(12,2),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_active ON analysis(active);

-- ANALYSIS PARAMETERS ----------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES analysis(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text,
  position integer,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_parameters_analysis ON analysis_parameters(analysis_id);

-- REFERENCE RANGES -------------------------------------------------
CREATE TABLE IF NOT EXISTS reference_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id uuid REFERENCES analysis_parameters(id) ON DELETE CASCADE,
  sex text CHECK (sex IN ('M','F','O') OR sex IS NULL),
  age_min numeric,
  age_max numeric,
  unit text,
  min_value numeric,
  max_value numeric,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reference_ranges_param ON reference_ranges(parameter_id);

-- WORK ORDERS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  order_number bigserial,
  status text NOT NULL DEFAULT 'pending',
  priority text,
  notes text,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_order_number ON work_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_patient ON work_orders(patient_id);

-- WORK ORDER ITEMS -------------------------------------------------
CREATE TABLE IF NOT EXISTS work_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES analysis(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  result_value text,
  validated_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_order_items_wo ON work_order_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_items_analysis ON work_order_items(analysis_id);

-- BRANCHES ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  address text,
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- REFERRERS (médicos / entidades) ---------------------------------
CREATE TABLE IF NOT EXISTS referrers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text,
  email text,
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- PACKAGES (agrupaciones de estudios) ------------------------------
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  description text,
  price numeric(12,2),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- TEMPLATE BÁSICA (reportes / emails) ------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  kind text NOT NULL DEFAULT 'report',
  subject text,
  body text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Simple trigger para updated_at (compartido) ----------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

-- Aplicar trigger a tablas con updated_at (solo si no existe el trigger)
DO $$
DECLARE r RECORD; 
BEGIN
  FOR r IN SELECT table_name FROM information_schema.columns 
           WHERE column_name='updated_at' AND table_schema='public' LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_'||r.table_name||'_updated_at') THEN
      EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE set_updated_at();', r.table_name, r.table_name);
    END IF;
  END LOOP;
END$$;

-- FIN 003 dominio core