-- 20251006_create_packages_view.sql
-- Propósito: Proveer objeto accesible 'packages' usado por rutas backend que hoy referencian tabla inexistente.
-- Estrategia: reutilizar tabla canonica 'analysis_packages' (ya creada en setup/tenant migrations) y exponer una vista updatable 'packages'.
-- Idempotente: seguro de ejecutar múltiples veces.
-- Nota: La vista es simple SELECT * => updatable; INSERT/UPDATE/DELETE fluyen a la tabla base.

BEGIN;

-- Asegurar tabla base (por si entorno parcial no la tiene todavía)
CREATE TABLE IF NOT EXISTS analysis_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- Crear/ reemplazar vista 'packages'. (No usar OR REPLACE si ya existe como tabla)
DO $$
BEGIN
  -- Si existe un objeto llamado 'packages'
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE c.relname='packages'
  ) THEN
    -- Verificar que sea una vista apuntando a analysis_packages
    IF EXISTS (
      SELECT 1 FROM information_schema.views WHERE table_name='packages'
    ) THEN
      -- Ya existe como vista; nada que hacer.
      RETURN;
    ELSE
      -- Existe pero no es vista (probablemente tabla antigua). En este caso no modificamos para evitar pérdida.
      RAISE NOTICE 'Objeto packages existe y no es vista; se deja intacto.';
      RETURN;
    END IF;
  END IF;

  EXECUTE 'CREATE VIEW packages AS SELECT * FROM analysis_packages';
END$$;

-- Índice auxiliar en nombre (ya existe en analysis_packages si se añadió fuera; aquí opcional)
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE c.relname='idx_packages_name_ci'
  ) THEN
    BEGIN
      EXECUTE 'CREATE INDEX idx_packages_name_ci ON analysis_packages (LOWER(name))';
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END$$;

COMMIT;
