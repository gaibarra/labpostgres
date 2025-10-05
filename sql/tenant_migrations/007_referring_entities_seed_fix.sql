-- 007_referring_entities_seed_fix.sql
-- Asegura semilla 'Particular' después de migración 006.
INSERT INTO referring_entities(name, entity_type)
  SELECT 'Particular','individual'
  WHERE NOT EXISTS (SELECT 1 FROM referring_entities WHERE LOWER(name)='particular');
