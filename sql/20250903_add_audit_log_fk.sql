-- 20250903_add_audit_log_fk.sql
-- Add foreign key relationship from system_audit_logs to profiles

-- Add profile_id column to link to profiles table
ALTER TABLE public.system_audit_logs
  ADD COLUMN IF NOT EXISTS profile_id uuid;

-- Clean up orphaned profile_id values before FK
UPDATE public.system_audit_logs sal
SET profile_id = NULL
WHERE profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = sal.profile_id
  );

-- Backfill existing audit entries from performed_by only if profile exists
UPDATE public.system_audit_logs sal
SET profile_id = sal.performed_by
FROM public.profiles p
WHERE sal.performed_by IS NOT NULL
  AND p.id = sal.performed_by;

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
