-- 20251010_add_method_to_reference_ranges.sql
-- Adds optional 'method' column to both legacy and modern reference ranges tables and supporting indexes.

DO $$ BEGIN
  BEGIN
    ALTER TABLE IF EXISTS reference_ranges ADD COLUMN IF NOT EXISTS method text;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    ALTER TABLE IF EXISTS analysis_reference_ranges ADD COLUMN IF NOT EXISTS method text;
  EXCEPTION WHEN undefined_table THEN NULL; END;
END $$;

DO $$ BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_reference_ranges_param_method ON reference_ranges(parameter_id, method);
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_analysis_reference_ranges_param_method ON analysis_reference_ranges(parameter_id, method);
  EXCEPTION WHEN undefined_table THEN NULL; END;
END $$;
