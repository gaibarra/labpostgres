-- 0004_security_policies.sql
-- Define funciones de ayuda y RLS / policies mínimas para operar.

BEGIN;

-- Crear esquema auth stub si no existe (entornos sin Supabase)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

-- Funciones auxiliares
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

-- Activar RLS en tablas clave (idempotente)
DO $$DECLARE r RECORD; BEGIN
  FOR r IN SELECT unnest(ARRAY[
    'profiles','system_audit_logs','patients','work_orders','work_order_results',
    'analysis','analysis_parameters','reference_ranges','analysis_packages','analysis_package_items',
    'referring_entities','price_list_items'
  ]) AS t LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.t);
  END LOOP;
END$$;

-- Policies (solo crear si no existen) -----------------------
-- Profiles
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_self_or_admin') THEN
    EXECUTE $p$CREATE POLICY profiles_select_self_or_admin ON profiles FOR SELECT USING ( id = auth.uid() OR is_admin() )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_insert_self') THEN
    EXECUTE $p$CREATE POLICY profiles_insert_self ON profiles FOR INSERT WITH CHECK ( id = auth.uid() )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update_self_or_admin') THEN
    EXECUTE $p$CREATE POLICY profiles_update_self_or_admin ON profiles FOR UPDATE USING ( id = auth.uid() OR is_admin() ) WITH CHECK ( id = auth.uid() OR is_admin() )$p$; END IF;
END$$;

-- Patients
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_select') THEN
    EXECUTE $p$CREATE POLICY patients_select ON patients FOR SELECT USING ( has_permission('patients','read') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_insert') THEN
    EXECUTE $p$CREATE POLICY patients_insert ON patients FOR INSERT WITH CHECK ( has_permission('patients','create') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_update') THEN
    EXECUTE $p$CREATE POLICY patients_update ON patients FOR UPDATE USING ( has_permission('patients','update') ) WITH CHECK ( has_permission('patients','update') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_delete') THEN
    EXECUTE $p$CREATE POLICY patients_delete ON patients FOR DELETE USING ( has_permission('patients','delete') )$p$; END IF;
END$$;

-- Referring entities
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_select') THEN
    EXECUTE $p$CREATE POLICY referrers_select ON referring_entities FOR SELECT USING ( has_permission('referrers','read') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_insert') THEN
    EXECUTE $p$CREATE POLICY referrers_insert ON referring_entities FOR INSERT WITH CHECK ( has_permission('referrers','create') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_update') THEN
    EXECUTE $p$CREATE POLICY referrers_update ON referring_entities FOR UPDATE USING ( has_permission('referrers','update') ) WITH CHECK ( has_permission('referrers','update') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referring_entities' AND policyname='referrers_delete') THEN
    EXECUTE $p$CREATE POLICY referrers_delete ON referring_entities FOR DELETE USING ( has_permission('referrers','delete') )$p$; END IF;
END$$;

-- Analysis
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis' AND policyname='analysis_select') THEN
    EXECUTE $p$CREATE POLICY analysis_select ON analysis FOR SELECT USING ( has_permission('studies','read') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis' AND policyname='analysis_insert') THEN
    EXECUTE $p$CREATE POLICY analysis_insert ON analysis FOR INSERT WITH CHECK ( has_permission('studies','create') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis' AND policyname='analysis_update') THEN
    EXECUTE $p$CREATE POLICY analysis_update ON analysis FOR UPDATE USING ( has_permission('studies','update') ) WITH CHECK ( has_permission('studies','update') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis' AND policyname='analysis_delete') THEN
    EXECUTE $p$CREATE POLICY analysis_delete ON analysis FOR DELETE USING ( has_permission('studies','delete') )$p$; END IF;
END$$;

-- Analysis parameters
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis_parameters' AND policyname='analysis_parameters_select') THEN
    EXECUTE $p$CREATE POLICY analysis_parameters_select ON analysis_parameters FOR SELECT USING ( has_permission('studies','read') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analysis_parameters' AND policyname='analysis_parameters_cud') THEN
    EXECUTE $p$CREATE POLICY analysis_parameters_cud ON analysis_parameters FOR ALL USING ( has_permission('studies','update') OR has_permission('studies','create') ) WITH CHECK ( has_permission('studies','update') OR has_permission('studies','create') )$p$; END IF;
END$$;

-- Reference ranges
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reference_ranges' AND policyname='reference_ranges_select') THEN
    EXECUTE $p$CREATE POLICY reference_ranges_select ON reference_ranges FOR SELECT USING ( has_permission('studies','read') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reference_ranges' AND policyname='reference_ranges_cud') THEN
    EXECUTE $p$CREATE POLICY reference_ranges_cud ON reference_ranges FOR ALL USING ( has_permission('studies','update') ) WITH CHECK ( has_permission('studies','update') )$p$; END IF;
END$$;

-- Work orders
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_orders' AND policyname='work_orders_select') THEN
    EXECUTE $p$CREATE POLICY work_orders_select ON work_orders FOR SELECT USING ( has_permission('orders','read_all') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_orders' AND policyname='work_orders_insert') THEN
    EXECUTE $p$CREATE POLICY work_orders_insert ON work_orders FOR INSERT WITH CHECK ( has_permission('orders','create') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_orders' AND policyname='work_orders_update') THEN
    EXECUTE $p$CREATE POLICY work_orders_update ON work_orders FOR UPDATE USING ( has_permission('orders','update_status') OR has_permission('orders','enter_results') ) WITH CHECK ( has_permission('orders','update_status') OR has_permission('orders','enter_results') )$p$; END IF;
END$$;

-- Work order results
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_order_results' AND policyname='work_order_results_select') THEN
    EXECUTE $p$CREATE POLICY work_order_results_select ON work_order_results FOR SELECT USING ( has_permission('orders','read_all') OR has_permission('orders','enter_results') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_order_results' AND policyname='work_order_results_cud') THEN
    EXECUTE $p$CREATE POLICY work_order_results_cud ON work_order_results FOR ALL USING ( has_permission('orders','enter_results') ) WITH CHECK ( has_permission('orders','enter_results') )$p$; END IF;
END$$;

-- Price list items
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_list_items' AND policyname='price_list_items_select') THEN
    EXECUTE $p$CREATE POLICY price_list_items_select ON price_list_items FOR SELECT USING ( has_permission('referrers','read') )$p$; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_list_items' AND policyname='price_list_items_cud') THEN
    EXECUTE $p$CREATE POLICY price_list_items_cud ON price_list_items FOR ALL USING ( has_permission('referrers','manage_pricelists') ) WITH CHECK ( has_permission('referrers','manage_pricelists') )$p$; END IF;
END$$;

COMMIT;
