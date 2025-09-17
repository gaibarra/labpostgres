-- Creación de tabla analysis_parameters (solo si no existe)
-- Fecha: 2025-09-01
-- Ajusta tipos según tu modelo original si difieren.

BEGIN;

-- Asegura que exista la tabla base 'analysis' antes de la FK
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

CREATE INDEX IF NOT EXISTS idx_analysis_name ON analysis(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis(category);

CREATE TABLE IF NOT EXISTS analysis_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analysis(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text,
  decimal_places int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_parameters_analysis_id ON analysis_parameters(analysis_id);

COMMIT;
