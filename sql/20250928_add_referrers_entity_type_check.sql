-- Añade constraint para restringir entity_type a 'Médico' o 'Institución'
-- Precondición: ejecutar antes la normalización (20250928_normalize_referrers_entity_type.sql)

ALTER TABLE referring_entities
  ADD CONSTRAINT chk_referring_entities_entity_type
  CHECK (entity_type IS NULL OR entity_type IN ('Médico','Institución'));

-- Rollback (manual):
-- ALTER TABLE referring_entities DROP CONSTRAINT IF EXISTS chk_referring_entities_entity_type;