-- Crea tabla de versionado del catálogo de análisis y parámetros
-- Incluye hash estable (sha256 sobre JSON canónico), diff opcional y snapshot completo.
CREATE TABLE IF NOT EXISTS catalog_versions (
  id bigserial PRIMARY KEY,
  version_number bigint NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  hash_sha256 char(64) NOT NULL UNIQUE,
  item_count int NOT NULL,
  range_count int NOT NULL,
  snapshot jsonb NOT NULL,
  diff_from_previous jsonb,
  previous_version bigint REFERENCES catalog_versions(version_number) ON DELETE SET NULL
);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_catalog_versions_created_at ON catalog_versions(created_at DESC);

-- Trigger opcional para prevenir retrocesos (simplificado): no permitir insertar version_number menor al máximo existente
CREATE OR REPLACE FUNCTION ensure_monotonic_catalog_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version_number <= COALESCE((SELECT max(version_number) FROM catalog_versions),0) THEN
    RAISE EXCEPTION 'version_number % no es mayor al máximo existente', NEW.version_number;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_monotonic_catalog_version ON catalog_versions;
CREATE TRIGGER trg_monotonic_catalog_version BEFORE INSERT ON catalog_versions
FOR EACH ROW EXECUTE FUNCTION ensure_monotonic_catalog_version();
