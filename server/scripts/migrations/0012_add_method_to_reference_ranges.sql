-- 0012_add_method_to_reference_ranges.sql
-- Adds optional 'method' column to reference ranges tables to support method-dependent intervals.

DO $$ BEGIN
  BEGIN
    ALTER TABLE analysis_reference_ranges ADD COLUMN IF NOT EXISTS method text;
  EXCEPTION WHEN undefined_table THEN
    -- Table may not exist in legacy-only tenants; ignore.
    NULL;
  END;
  BEGIN
    ALTER TABLE reference_ranges ADD COLUMN IF NOT EXISTS method text;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
END $$;

-- Helpful indexes
DO $$ BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_arr_parameter_method ON analysis_reference_ranges(parameter_id, method);
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_rr_parameter_method ON reference_ranges(parameter_id, method);
  EXCEPTION WHEN undefined_table THEN NULL; END;
END $$;
