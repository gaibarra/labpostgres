-- AUTO-GENERATED alignment migration
-- Fecha: 2025-10-01T20:34:16.137Z
-- Referencia: lab
-- NOTA: Sólo agrega tablas/columnas faltantes. No borra ni cambia tipos existentes.

-- Tabla: ad_campaigns
CREATE TABLE IF NOT EXISTS public.ad_campaigns ();
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'Activa';
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "budget" numeric(12,2);
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "platform" text;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "start_date" date;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "end_date" date;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "objectives" text;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS "kpis" jsonb DEFAULT '{}';
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='ad_campaigns'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.ad_campaigns ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: analysis
CREATE TABLE IF NOT EXISTS public.analysis ();
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "clave" text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "indications" text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "sample_type" text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "sample_container" text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "processing_time_hours" int4;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "general_units" text;
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.analysis ADD COLUMN IF NOT EXISTS "price" numeric(10,2);
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='analysis'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.analysis ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: analysis_package_items
CREATE TABLE IF NOT EXISTS public.analysis_package_items ();
ALTER TABLE public.analysis_package_items ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.analysis_package_items ADD COLUMN IF NOT EXISTS "package_id" uuid;
ALTER TABLE public.analysis_package_items ADD COLUMN IF NOT EXISTS "item_id" uuid;
ALTER TABLE public.analysis_package_items ADD COLUMN IF NOT EXISTS "item_type" text DEFAULT 'analysis' NOT NULL;
ALTER TABLE public.analysis_package_items ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='analysis_package_items'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.analysis_package_items ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: analysis_packages
CREATE TABLE IF NOT EXISTS public.analysis_packages ();
ALTER TABLE public.analysis_packages ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.analysis_packages ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.analysis_packages ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public.analysis_packages ADD COLUMN IF NOT EXISTS "price" numeric(10,2);
ALTER TABLE public.analysis_packages ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='analysis_packages'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.analysis_packages ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: analysis_parameters
CREATE TABLE IF NOT EXISTS public.analysis_parameters ();
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS "analysis_id" uuid;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS "unit" text;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS "decimal_places" int4;
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.analysis_parameters ADD COLUMN IF NOT EXISTS "position" int4;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='analysis_parameters'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.analysis_parameters ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: branches
CREATE TABLE IF NOT EXISTS public.branches ();
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "is_active" bool DEFAULT true;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "zip_code" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "manager_name" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "operating_hours" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "folio_prefix" text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS "is_main" bool DEFAULT false;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='branches'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.branches ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: email_campaign_templates
CREATE TABLE IF NOT EXISTS public.email_campaign_templates ();
ALTER TABLE public.email_campaign_templates ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.email_campaign_templates ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.email_campaign_templates ADD COLUMN IF NOT EXISTS "subject" text;
ALTER TABLE public.email_campaign_templates ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE public.email_campaign_templates ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.email_campaign_templates ADD COLUMN IF NOT EXISTS "guide" text;
ALTER TABLE public.email_campaign_templates ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='email_campaign_templates'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.email_campaign_templates ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: email_campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns ();
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "subject" text;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "list_id" uuid;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "template_id" uuid;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "send_date_time" timestamptz;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS "metrics" jsonb DEFAULT '{}';
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='email_campaigns'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.email_campaigns ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: email_list_subscribers
CREATE TABLE IF NOT EXISTS public.email_list_subscribers ();
ALTER TABLE public.email_list_subscribers ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.email_list_subscribers ADD COLUMN IF NOT EXISTS "list_id" uuid;
ALTER TABLE public.email_list_subscribers ADD COLUMN IF NOT EXISTS "subscriber_id" uuid;
ALTER TABLE public.email_list_subscribers ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='email_list_subscribers'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.email_list_subscribers ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: email_lists
CREATE TABLE IF NOT EXISTS public.email_lists ();
ALTER TABLE public.email_lists ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.email_lists ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.email_lists ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='email_lists'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.email_lists ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: expenses
CREATE TABLE IF NOT EXISTS public.expenses ();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "expense_date" date DEFAULT CURRENT_DATE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "concept" text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "amount" numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='expenses'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.expenses ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: lab_assets
CREATE TABLE IF NOT EXISTS public.lab_assets ();
ALTER TABLE public.lab_assets ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.lab_assets ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE public.lab_assets ADD COLUMN IF NOT EXISTS "url" text;
ALTER TABLE public.lab_assets ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='lab_assets'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.lab_assets ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: lab_configuration
CREATE TABLE IF NOT EXISTS public.lab_configuration ();
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "lab_info" jsonb DEFAULT '{}';
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "report_settings" jsonb DEFAULT '{}';
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "ui_settings" jsonb DEFAULT '{}';
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "regional_settings" jsonb DEFAULT '{}';
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "integrations_settings" jsonb DEFAULT '{}';
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "tax_settings" jsonb DEFAULT '{}';
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();
ALTER TABLE public.lab_configuration ADD COLUMN IF NOT EXISTS "integrations_meta" jsonb DEFAULT '{}';
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='lab_configuration'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.lab_configuration ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: loyalty_participants
CREATE TABLE IF NOT EXISTS public.loyalty_participants ();
ALTER TABLE public.loyalty_participants ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.loyalty_participants ADD COLUMN IF NOT EXISTS "program_id" uuid;
ALTER TABLE public.loyalty_participants ADD COLUMN IF NOT EXISTS "patient_id" uuid;
ALTER TABLE public.loyalty_participants ADD COLUMN IF NOT EXISTS "current_level_id" uuid;
ALTER TABLE public.loyalty_participants ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='loyalty_participants'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.loyalty_participants ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: loyalty_program_levels
CREATE TABLE IF NOT EXISTS public.loyalty_program_levels ();
ALTER TABLE public.loyalty_program_levels ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.loyalty_program_levels ADD COLUMN IF NOT EXISTS "program_id" uuid;
ALTER TABLE public.loyalty_program_levels ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.loyalty_program_levels ADD COLUMN IF NOT EXISTS "threshold" int4;
ALTER TABLE public.loyalty_program_levels ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.loyalty_program_levels ADD COLUMN IF NOT EXISTS "description" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='loyalty_program_levels'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.loyalty_program_levels ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: loyalty_programs
CREATE TABLE IF NOT EXISTS public.loyalty_programs ();
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "rules" text;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "start_date" date;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "end_date" date;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'Borrador';
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='loyalty_programs'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.loyalty_programs ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: organizations
CREATE TABLE IF NOT EXISTS public.organizations ();
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS "plan_id" text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='organizations'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.organizations ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: patients
CREATE TABLE IF NOT EXISTS public.patients ();
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "date_of_birth" date;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "sex" text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "phone_number" text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "contact_name" text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "contact_phone" text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "clinical_history" text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='patients'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.patients ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: payments
CREATE TABLE IF NOT EXISTS public.payments ();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "patient_id" uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "amount" numeric(12,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "method" text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "payment_date" timestamptz DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='payments'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.payments ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: price_list_items
CREATE TABLE IF NOT EXISTS public.price_list_items ();
ALTER TABLE public.price_list_items ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.price_list_items ADD COLUMN IF NOT EXISTS "referrer_id" uuid;
ALTER TABLE public.price_list_items ADD COLUMN IF NOT EXISTS "analysis_id" uuid;
ALTER TABLE public.price_list_items ADD COLUMN IF NOT EXISTS "custom_price" numeric(10,2);
ALTER TABLE public.price_list_items ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='price_list_items'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.price_list_items ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: profiles
CREATE TABLE IF NOT EXISTS public.profiles ();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "last_name" text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "theme" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='profiles'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.profiles ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: reference_ranges
CREATE TABLE IF NOT EXISTS public.reference_ranges ();
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "parameter_id" uuid;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "sex" text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "age_min" int4;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "age_max" int4;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "age_min_unit" text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "lower" numeric;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "upper" numeric;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "text_value" text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public.reference_ranges ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='reference_ranges'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.reference_ranges ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: referring_entities
CREATE TABLE IF NOT EXISTS public.referring_entities ();
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "entity_type" text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "specialty" text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "listaprecios" jsonb;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "phone_number" text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS "address" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='referring_entities'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.referring_entities ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: roles
CREATE TABLE IF NOT EXISTS public.roles ();
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS "role_name" text;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS "color_class" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='roles'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.roles ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: roles_permissions
CREATE TABLE IF NOT EXISTS public.roles_permissions ();
ALTER TABLE public.roles_permissions ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.roles_permissions ADD COLUMN IF NOT EXISTS "role_name" text;
ALTER TABLE public.roles_permissions ADD COLUMN IF NOT EXISTS "permissions" jsonb DEFAULT '{}';
ALTER TABLE public.roles_permissions ADD COLUMN IF NOT EXISTS "is_system_role" bool DEFAULT false;
ALTER TABLE public.roles_permissions ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='roles_permissions'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.roles_permissions ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: schema_migrations
CREATE TABLE IF NOT EXISTS public.schema_migrations ();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schema_migrations' AND column_name='id'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS schema_migrations_id_seq;
    ALTER TABLE public.schema_migrations ADD COLUMN id int4 NOT NULL DEFAULT nextval('schema_migrations_id_seq');
  END IF;
END$$;
ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS "filename" text;
ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS "checksum" text;
ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS "executed_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='schema_migrations'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.schema_migrations ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: seo_keywords
CREATE TABLE IF NOT EXISTS public.seo_keywords ();
ALTER TABLE public.seo_keywords ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.seo_keywords ADD COLUMN IF NOT EXISTS "keyword" text;
ALTER TABLE public.seo_keywords ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.seo_keywords ADD COLUMN IF NOT EXISTS "target_url" text;
ALTER TABLE public.seo_keywords ADD COLUMN IF NOT EXISTS "volume" int4;
ALTER TABLE public.seo_keywords ADD COLUMN IF NOT EXISTS "difficulty" int4;
ALTER TABLE public.seo_keywords ADD COLUMN IF NOT EXISTS "position" int4;
ALTER TABLE public.seo_keywords ADD COLUMN IF NOT EXISTS "notes" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='seo_keywords'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.seo_keywords ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: social_media_posts
CREATE TABLE IF NOT EXISTS public.social_media_posts ();
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "platform" text;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'Borrador';
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "engagement" jsonb;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "publish_date_time" timestamptz;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "content_type" text;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "media_url" text;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "hashtags" text;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS "notes" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='social_media_posts'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.social_media_posts ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: subscribers
CREATE TABLE IF NOT EXISTS public.subscribers ();
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'Activo';
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='subscribers'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.subscribers ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: system_audit_logs
CREATE TABLE IF NOT EXISTS public.system_audit_logs ();
ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS "action" text;
ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS "details" jsonb;
ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS "performed_by" uuid;
ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS "profile_id" uuid;
ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS "entity" text;
ALTER TABLE public.system_audit_logs ADD COLUMN IF NOT EXISTS "entity_id" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='system_audit_logs'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.system_audit_logs ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: system_parameters
CREATE TABLE IF NOT EXISTS public.system_parameters ();
ALTER TABLE public.system_parameters ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.system_parameters ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.system_parameters ADD COLUMN IF NOT EXISTS "value" text;
ALTER TABLE public.system_parameters ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.system_parameters ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='system_parameters'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.system_parameters ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: templates
CREATE TABLE IF NOT EXISTS public.templates ();
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "template_data" jsonb;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "header" text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "footer" text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "is_default" bool DEFAULT false;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS "is_system" bool DEFAULT false;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='templates'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.templates ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: user_org_memberships
CREATE TABLE IF NOT EXISTS public.user_org_memberships ();
ALTER TABLE public.user_org_memberships ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.user_org_memberships ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public.user_org_memberships ADD COLUMN IF NOT EXISTS "org_id" uuid;
ALTER TABLE public.user_org_memberships ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE public.user_org_memberships ADD COLUMN IF NOT EXISTS "is_owner" bool DEFAULT false;
ALTER TABLE public.user_org_memberships ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='user_org_memberships'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.user_org_memberships ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: users
CREATE TABLE IF NOT EXISTS public.users ();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "token_version" int4 DEFAULT 1;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='users'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.users ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: web_content
CREATE TABLE IF NOT EXISTS public.web_content ();
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "author" text;
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "publish_date" date;
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE public.web_content ADD COLUMN IF NOT EXISTS "tags" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='web_content'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.web_content ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: work_order_results
CREATE TABLE IF NOT EXISTS public.work_order_results ();
ALTER TABLE public.work_order_results ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.work_order_results ADD COLUMN IF NOT EXISTS "work_order_id" uuid;
ALTER TABLE public.work_order_results ADD COLUMN IF NOT EXISTS "parameter_id" uuid;
ALTER TABLE public.work_order_results ADD COLUMN IF NOT EXISTS "value_numeric" numeric;
ALTER TABLE public.work_order_results ADD COLUMN IF NOT EXISTS "value_text" text;
ALTER TABLE public.work_order_results ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='work_order_results'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.work_order_results ADD PRIMARY KEY ("id");
  END IF;
END$$;

-- Tabla: work_orders
CREATE TABLE IF NOT EXISTS public.work_orders ();
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "folio" text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "patient_id" uuid;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "referring_entity_id" uuid;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "referring_doctor_id" uuid;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "order_date" timestamptz DEFAULT now();
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "selected_items" jsonb;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "total_price" numeric(12,2);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "results_finalized" bool DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "receipt_generated" bool DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "assigned_to" uuid;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "results" jsonb;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "validation_notes" text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "subtotal" numeric(12,2);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "descuento" numeric(12,2);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "anticipo" numeric(12,2);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS "notas" text;
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint ct
    JOIN pg_class c ON c.oid = ct.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ct.contype='p' AND n.nspname='public' AND c.relname='work_orders'
  ) THEN
    -- Intentar crear PK (puede fallar si tipos no compatibles / datos duplicados)
    ALTER TABLE public.work_orders ADD PRIMARY KEY ("id");
  END IF;
END$$;

