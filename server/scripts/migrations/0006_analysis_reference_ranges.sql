-- 0006_analysis_reference_ranges.sql
-- Crea tabla separada para rangos de referencia del catálogo moderno (analysis_parameters)
-- Evita colisión con la tabla legacy reference_ranges ligada a parameters.

CREATE TABLE IF NOT EXISTS analysis_reference_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id uuid NOT NULL REFERENCES analysis_parameters(id) ON DELETE CASCADE,
  sex text,
  age_min integer,
  age_max integer,
  age_min_unit text DEFAULT 'años',
  lower numeric,
  upper numeric,
  text_value text,
  notes text,
  unit text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_arr_parameter ON analysis_reference_ranges(parameter_id);
