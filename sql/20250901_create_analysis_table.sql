-- Creación de tabla base 'analysis' (si no existe)
-- Ajusta los campos según tus necesidades reales.
-- Debe ejecutarse antes de crear 'analysis_parameters' si la tabla aún no existe.

BEGIN;

CREATE TABLE IF NOT EXISTS analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text UNIQUE,
  name text NOT NULL,
  category text,
  description text,
  indications text,
  sample_type text,
  sample_container text,
  processing_time_hours int,
  general_units text,
  created_at timestamptz DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_analysis_name ON analysis(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis(category);

COMMIT;
