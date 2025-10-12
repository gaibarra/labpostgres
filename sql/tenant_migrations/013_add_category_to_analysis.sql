-- 013_add_category_to_analysis.sql
-- Crea la columna 'category' en analysis para todos los tenants y su índice.
-- Idempotente.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='analysis') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='analysis' AND column_name='category'
    ) THEN
      ALTER TABLE analysis ADD COLUMN category text;
    END IF;
    -- Índice para filtros
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis(category);
    EXCEPTION WHEN duplicate_table THEN
      -- ignorar
      NULL;
    END;
    -- Comentario helpful
    BEGIN
      COMMENT ON COLUMN analysis.category IS 'Categoría profesional del estudio (Hematología, Química Clínica, Coagulación, etc.)';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
  END IF;
END$$;
