-- Example initial tenant migration
-- This would normally create the baseline schema for a tenant DB
-- Keep each migration idempotent or guarded; rely on ordering.

CREATE TABLE IF NOT EXISTS tenant_example_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note text,
  created_at timestamptz DEFAULT now()
);
