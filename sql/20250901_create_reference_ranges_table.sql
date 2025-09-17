-- Creación de tabla reference_ranges (si no existe)
-- Fecha: 2025-09-01
-- Ejecutar antes de scripts de normalización si la tabla aún no está creada.

BEGIN;

CREATE TABLE IF NOT EXISTS reference_ranges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id  uuid NOT NULL REFERENCES analysis_parameters(id) ON DELETE CASCADE,
  sex           text,            -- se normaliza luego a: ambos/masculino/femenino
  age_min       integer,
  age_max       integer,
  age_min_unit  text,            -- se normaliza luego a: días/meses/años
  lower         numeric,
  upper         numeric,
  text_value    text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reference_ranges_param_id ON reference_ranges(parameter_id);

COMMIT;
