-- 009_restore_particular_referrer.sql
-- Restaura el referente 'Particular' si fue eliminado accidentalmente.
-- Idempotente: sólo inserta si no existe (case-insensitive) en referring_entities.

DO $$
DECLARE
  cols text[] := ARRAY[]::text[];
  sql text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referring_entities') THEN
    RAISE NOTICE 'Tabla referring_entities no existe, nada que hacer';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM referring_entities WHERE lower(name)='particular') THEN
    RAISE NOTICE '"Particular" ya existe';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referring_entities' AND column_name='name') THEN cols := cols || 'name'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referring_entities' AND column_name='entity_type') THEN cols := cols || 'entity_type'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referring_entities' AND column_name='email') THEN cols := cols || 'email'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referring_entities' AND column_name='phone') THEN cols := cols || 'phone'; END IF; -- puede no existir
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referring_entities' AND column_name='active') THEN cols := cols || 'active'; END IF;

  IF array_length(cols,1) IS NULL THEN
    RAISE NOTICE 'No columnas relevantes'; RETURN;
  END IF;

  sql := 'INSERT INTO referring_entities(' || array_to_string(cols,',') || ') VALUES(' || (
    SELECT string_agg(CASE c
      WHEN 'name' THEN quote_literal('Particular')
      WHEN 'entity_type' THEN 'NULL'
      WHEN 'email' THEN 'NULL'
      WHEN 'phone' THEN 'NULL'
      WHEN 'active' THEN 'TRUE'
      ELSE 'NULL' END, ',') FROM unnest(cols) c
  ) || ')';

  EXECUTE sql;
  RAISE NOTICE 'Insertado Particular con columnas: %', array_to_string(cols,',');
END $$;
