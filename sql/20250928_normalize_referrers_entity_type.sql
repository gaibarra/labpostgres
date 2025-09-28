-- Normaliza entity_type en referring_entities a solo 'Médico' o 'Institución'
-- Cualquier variante de médico (doctor, medico, dr, dra) => 'Médico'
-- Cualquier otra cosa distinta a 'Institución' pasa a 'Médico' (salvo NULL)

BEGIN;

-- Primero normalizar instituciones a forma con tilde
UPDATE referring_entities
SET entity_type = 'Institución'
WHERE entity_type ILIKE 'institucion' OR entity_type ILIKE 'institución' OR entity_type ILIKE 'inst%';

-- Luego normalizar médicos / doctores
UPDATE referring_entities
SET entity_type = 'Médico'
WHERE entity_type ILIKE 'medico'
   OR entity_type ILIKE 'médico'
   OR entity_type ILIKE 'doctor'
   OR entity_type ILIKE 'dr'
   OR entity_type ILIKE 'dra';

-- Cualquier otro valor distinto de NULL y distinto de 'Institución' pasa a 'Médico'
UPDATE referring_entities
SET entity_type = 'Médico'
WHERE entity_type IS NOT NULL
  AND entity_type NOT IN ('Médico','Institución');

COMMIT;

-- Para revertir manualmente (rollback simple no exacto):
-- UPDATE referring_entities SET entity_type = NULL WHERE entity_type NOT IN ('Médico','Institución');