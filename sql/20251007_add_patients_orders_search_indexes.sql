-- 20251007_add_patients_orders_search_indexes.sql
-- Optimiza búsquedas para endpoints paginados de patients y work_orders.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trabajar con columnas opcionales en patients sin fallar si no existen.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_email_lower ON patients ((LOWER(email)))';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='document_number'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_document_lower ON patients ((LOWER(document_number)))';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='external_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_external_lower ON patients ((LOWER(external_id)))';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='phone'
  ) THEN
    EXECUTE $$CREATE INDEX IF NOT EXISTS idx_patients_phone_digits
              ON patients ((regexp_replace(phone::text, '\\D', '', 'g')))$$;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='phone_number'
  ) THEN
    EXECUTE $$CREATE INDEX IF NOT EXISTS idx_patients_phone_number_digits
              ON patients ((regexp_replace(phone_number::text, '\\D', '', 'g')))$$;
  END IF;
END$$;

-- work_orders indexes for folio + status + order_date sort
CREATE INDEX IF NOT EXISTS idx_work_orders_folio_trgm ON work_orders USING gin (folio gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_work_orders_status_lower ON work_orders ((LOWER(status)));
CREATE INDEX IF NOT EXISTS idx_work_orders_order_date_desc ON work_orders (order_date DESC);