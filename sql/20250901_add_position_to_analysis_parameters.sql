-- Añade columna position para ordenar parámetros de un estudio
-- Idempotente
BEGIN;
ALTER TABLE analysis_parameters ADD COLUMN IF NOT EXISTS position int;
-- Rellenar posiciones faltantes por (analysis_id, created_at)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY analysis_id ORDER BY created_at, name) AS rn
  FROM analysis_parameters
  WHERE position IS NULL
)
UPDATE analysis_parameters ap
SET position = o.rn
FROM ordered o
WHERE ap.id = o.id;
-- Índice para ordenar rápido
CREATE INDEX IF NOT EXISTS idx_analysis_parameters_analysis_id_position ON analysis_parameters(analysis_id, position);
COMMIT;
