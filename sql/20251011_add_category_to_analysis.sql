-- Añade columna de categoría profesional a analysis y su índice
-- Idempotente
ALTER TABLE IF EXISTS public.analysis
  ADD COLUMN IF NOT EXISTS category text;

-- Índice para filtros por categoría
CREATE INDEX IF NOT EXISTS idx_analysis_category ON public.analysis(category);

-- Comentario descriptivo
COMMENT ON COLUMN public.analysis.category IS 'Categoría profesional del estudio (p.ej., Hematología, Química Clínica, Coagulación, etc.)';
