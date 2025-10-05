-- Añade constraint para restringir entity_type a 'Médico' o 'Institución'
-- Ahora auto-normaliza valores antes de crear el constraint para evitar dependencia estricta del script de normalización.
-- Idempotente: DROP IF EXISTS previo, normaliza sólo si la tabla y columna existen.

DO $$
BEGIN
  -- Verificar existencia de tabla y columna
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referring_entities') THEN
    RAISE NOTICE 'Tabla referring_entities no existe, nada que hacer';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referring_entities' AND column_name='entity_type') THEN
    RAISE NOTICE 'Columna entity_type no existe en referring_entities';
    RETURN;
  END IF;

  -- Normalización inline (similar al script separado)
  UPDATE referring_entities
    SET entity_type = 'Institución'
    WHERE entity_type ILIKE 'institucion' OR entity_type ILIKE 'institución' OR entity_type ILIKE 'inst%';

  UPDATE referring_entities
    SET entity_type = 'Médico'
    WHERE entity_type ILIKE 'medico'
       OR entity_type ILIKE 'médico'
       OR entity_type ILIKE 'doctor'
       OR entity_type ILIKE 'dr'
       OR entity_type ILIKE 'dra';

  UPDATE referring_entities
    SET entity_type = 'Médico'
    WHERE entity_type IS NOT NULL
      AND entity_type NOT IN ('Médico','Institución');

  -- Eliminar constraint previo si existe para permitir re-ejecución
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='referring_entities' AND constraint_name='chk_referring_entities_entity_type'
  ) THEN
    EXECUTE 'ALTER TABLE referring_entities DROP CONSTRAINT chk_referring_entities_entity_type';
  END IF;

  -- Crear constraint final
  EXECUTE E'ALTER TABLE referring_entities\n    ADD CONSTRAINT chk_referring_entities_entity_type\n    CHECK (entity_type IS NULL OR entity_type IN (''Médico'',''Institución''))';
  RAISE NOTICE 'Constraint chk_referring_entities_entity_type creado tras normalización';
END $$;

-- Rollback (manual):
-- ALTER TABLE referring_entities DROP CONSTRAINT IF EXISTS chk_referring_entities_entity_type;