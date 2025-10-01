-- Multi-tenant master schema (one DB per laboratory)
-- Run this in the MASTER database only (e.g. lab_master)
-- This DB stores metadata & auth for tenant administrators.
-- Tenant business data lives in separate per-tenant databases.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive emails / slugs

-- Laboratories (tenants)
CREATE TABLE IF NOT EXISTS tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            citext UNIQUE NOT NULL,             -- short code (dns-friendly)
  db_name         text UNIQUE NOT NULL,               -- physical database name
  status          text NOT NULL DEFAULT 'active',     -- active | suspended | deleting
  plan            text NOT NULL DEFAULT 'standard',   -- commercial plan tag
  db_version      integer NOT NULL DEFAULT 1,         -- schema version applied to tenant DB
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_status_chk CHECK (status IN ('active','suspended','deleting'))
);

CREATE TABLE IF NOT EXISTS tenant_admins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           citext NOT NULL,
  password_hash   text NOT NULL,
  role            text NOT NULL DEFAULT 'owner',      -- owner | admin | support
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- Simple audit events (optional, can be expanded)
CREATE TABLE IF NOT EXISTS tenant_events (
  id              bigserial PRIMARY KEY,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
  event_type      text NOT NULL,          -- provisioned | suspended | resumed | upgrade | downgrade
  meta            jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- View showing only active tenants (handy for provisioning loops)
CREATE OR REPLACE VIEW active_tenants AS
  SELECT * FROM tenants WHERE status = 'active';

-- Seed example (REMOVE in production):
-- INSERT INTO tenants (slug, db_name) VALUES ('demo', 'lab_tenant_demo') ON CONFLICT DO NOTHING;
-- INSERT INTO tenant_admins (tenant_id, email, password_hash)
--   SELECT id, 'owner@demo.local', '$2b$10$REPLACE_WITH_BCRYPT_HASH' FROM tenants WHERE slug='demo'
--   ON CONFLICT DO NOTHING;

-- To provision a new tenant database (example procedure, run manually OR automate in app layer):
-- 1) CREATE DATABASE lab_tenant_<slug> TEMPLATE lab_template  (or run schema migrations)
-- 2) INSERT INTO tenants(slug, db_name) VALUES('<slug>', 'lab_tenant_<slug>');
-- 3) INSERT admin user row with hashed password.
-- 4) Record event in tenant_events.
