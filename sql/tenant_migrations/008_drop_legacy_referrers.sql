-- 008_drop_legacy_referrers.sql
-- Propósito: Eliminar tablas legacy 'referrers' o mal nombradas 'referres' ahora reemplazadas por 'referring_entities'.
-- Idempotente y seguro: Solo elimina si existe y la tabla canonical 'referring_entities' existe.
-- Precaución: Asume que la migración 006 ya migró cualquier dato necesario.

DO $$
DECLARE
  has_referrers boolean := false;
  has_referres boolean := false;
  has_canonical boolean := false;
  referrers_rows int := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referring_entities') INTO has_canonical;
  IF NOT has_canonical THEN
    RAISE NOTICE 'Tabla canonical referring_entities no existe; no se eliminará nada';
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referrers') INTO has_referrers;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referres') INTO has_referres;

  IF has_referrers THEN
    EXECUTE 'SELECT COUNT(*) FROM referrers' INTO referrers_rows;
    IF referrers_rows > 0 THEN
      RAISE NOTICE 'referrers tiene % filas. Se asume migradas previamente. Procediendo a DROP', referrers_rows;
    END IF;
    EXECUTE 'DROP TABLE IF EXISTS referrers CASCADE';
    RAISE NOTICE 'Tabla referrers eliminada';
  END IF;

  IF has_referres THEN
    EXECUTE 'DROP TABLE IF EXISTS referres CASCADE';
    RAISE NOTICE 'Tabla referres eliminada';
  END IF;
END $$;

-- Asegurar índice único en nombre de entidad canonical si no existe (defensivo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='referring_entities') THEN
    BEGIN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS referring_entities_name_unique ON referring_entities(lower(name))';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'No se pudo crear índice único (quizá ya existe con diferente nombre): %', SQLERRM;
    END;
  END IF;
END $$;
