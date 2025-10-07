-- Core schema for tenant databases
CREATE TABLE IF NOT EXISTS studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID REFERENCES studies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT DEFAULT '',
  decimal_places INT DEFAULT 0,
  position INT,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_parameters_study ON parameters(study_id);
CREATE TABLE IF NOT EXISTS reference_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id UUID REFERENCES parameters(id) ON DELETE CASCADE,
  sexo TEXT DEFAULT 'Ambos',
  edad_min NUMERIC,
  edad_max NUMERIC,
  edad_unit TEXT DEFAULT 'años',
  valor_min NUMERIC,
  valor_max NUMERIC,
  tipo_valor TEXT DEFAULT 'numerico',
  texto_permitido TEXT DEFAULT '',
  texto_libre TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reference_ranges_param ON reference_ranges(parameter_id);
