-- Add position/ordering to package items and provide deterministic ordering per package
-- Date: 2025-11-08

BEGIN;

-- 1) Add column if missing
ALTER TABLE IF EXISTS analysis_package_items
  ADD COLUMN IF NOT EXISTS position integer;

-- 2) Backfill positions for existing rows (per package, by created_at then id)
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY package_id ORDER BY created_at, id) AS rn
  FROM analysis_package_items
)
UPDATE analysis_package_items i
SET position = o.rn
FROM ordered o
WHERE i.id = o.id AND i.position IS NULL;

-- 3) Enforce NOT NULL (after backfill)
ALTER TABLE analysis_package_items
  ALTER COLUMN position SET NOT NULL;

-- 4) Add unique constraint to avoid duplicate positions inside a package
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_analysis_package_items_package_pos'
  ) THEN
    ALTER TABLE analysis_package_items
      ADD CONSTRAINT uq_analysis_package_items_package_pos UNIQUE (package_id, position);
  END IF;
END$$;

-- 5) Create helpful index for ordering queries
CREATE INDEX IF NOT EXISTS idx_analysis_package_items_package_pos
  ON analysis_package_items(package_id, position);

COMMIT;
