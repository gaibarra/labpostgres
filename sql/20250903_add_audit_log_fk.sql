-- 20250903_add_audit_log_fk.sql
-- Add foreign key relationship from system_audit_logs to profiles

-- Add profile_id column to link to profiles table
ALTER TABLE public.system_audit_logs
  ADD COLUMN IF NOT EXISTS profile_id uuid;

-- Backfill existing audit entries from performed_by (user who performed the action)
UPDATE public.system_audit_logs
SET profile_id = performed_by
WHERE performed_by IS NOT NULL;

-- Create foreign key constraint
DO $$BEGIN
  PERFORM 1 FROM pg_constraint WHERE conname='fk_system_audit_logs_profile';
  IF NOT FOUND THEN
    BEGIN
      ALTER TABLE public.system_audit_logs
        ADD CONSTRAINT fk_system_audit_logs_profile
        FOREIGN KEY (profile_id)
        REFERENCES public.profiles(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;
