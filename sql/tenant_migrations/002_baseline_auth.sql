-- 002_baseline_auth.sql
-- Crea tablas base esperadas en cada base de datos de tenant.
-- Ejecutado por runTenantMigrations.js (incrementa db_version a 2).
-- Idempotencia: usa IF NOT EXISTS y chequeos simples.

-- Extensiones necesarias (si faltan). No falla si no tienes permisos (rails fallback).
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;    -- emails case-insensitive

-- USERS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  token_version integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email_ci ON users (email);

-- PROFILES (mantén flexible para variantes futuras) ---------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE, -- opcional enlace 1-1
  email citext UNIQUE,
  full_name text,
  role text DEFAULT 'Invitado',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email_ci ON profiles(email);
-- FK (intenta crear si user_id existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='profiles_user_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN NULL; -- ignorar si falla
    END;
  END IF;
END;$$;

-- ROLES / PERMISOS ------------------------------------------------
CREATE TABLE IF NOT EXISTS roles_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roles_permissions_role ON roles_permissions(role_name);

-- SEED MINIMO (solo si vacío) -------------------------------------
DO $$
DECLARE c INT; BEGIN
  SELECT COUNT(*) INTO c FROM roles_permissions;
  IF c = 0 THEN
    INSERT INTO roles_permissions (role_name, permissions, is_system_role) VALUES
      ('Administrador', jsonb_build_object(
        'patients', ARRAY['create','read','update','delete'],
        'orders', ARRAY['create','read_all','read_assigned','update_status','enter_results','validate_results','print_report','send_report'],
        'administration', ARRAY['manage_users','manage_roles','system_settings','view_audit_log'],
        'profiles', ARRAY['read']
      ), true),
      ('Invitado', '{}'::jsonb, true);
  END IF; END;$$;

-- FUTURO: agregar aquí patients / work_orders / analysis (migraciones siguientes) --

-- FIN 002