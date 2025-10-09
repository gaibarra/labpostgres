-- 0011_antibiogram_schema.sql
-- Crea catálogo de antibióticos y resultados de antibiograma (modelo normalizado)

BEGIN;

-- Catálogo de antibióticos
CREATE TABLE IF NOT EXISTS antibiotics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  class text,
  is_active boolean DEFAULT true,
  synonyms jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION antibiotics_set_updated_at()
RETURNS trigger AS $$BEGIN NEW.updated_at = now(); RETURN NEW; END;$$ LANGUAGE plpgsql;
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_antibiotics_updated_at') THEN
    CREATE TRIGGER trg_antibiotics_updated_at BEFORE UPDATE ON antibiotics
      FOR EACH ROW EXECUTE FUNCTION antibiotics_set_updated_at();
  END IF;
END$$;

-- Resultados de antibiograma por antibiótico (una fila por antibiótico)
CREATE TABLE IF NOT EXISTS antibiogram_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES analysis(id) ON DELETE SET NULL,
  isolate_no smallint DEFAULT 1, -- por si hay múltiples aislamientos
  organism text,                 -- nombre del organismo identificado
  specimen_type text,            -- tipo de muestra
  method text,                   -- Kirby-Bauer, MIC, Etest
  standard text,                 -- CLSI / EUCAST
  standard_version text,         -- p.ej. 2024
  antibiotic_id uuid REFERENCES antibiotics(id) ON DELETE CASCADE,
  measure_type text,             -- ZONE / MIC
  value_numeric numeric,         -- mm (zona) o ug/mL (MIC)
  unit text,                     -- mm / ug/mL
  interpretation text,           -- S / I / R
  comments text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_antibiogram_results_order ON antibiogram_results(work_order_id);
CREATE INDEX IF NOT EXISTS idx_antibiogram_results_analysis ON antibiogram_results(analysis_id);
CREATE INDEX IF NOT EXISTS idx_antibiogram_results_antibiotic ON antibiogram_results(antibiotic_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_antibiogram_unique ON antibiogram_results(work_order_id, analysis_id, isolate_no, antibiotic_id);

COMMIT;
