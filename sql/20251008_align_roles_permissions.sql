-- 20251008_align_roles_permissions.sql
-- Corrige tenants que se sembraron sólo con seed inline de auth.js sin módulos 'studies', 'referrers', 'packages'.
-- Idempotente: añade llaves faltantes.
BEGIN;

-- Administrador: merge si faltan claves
UPDATE roles_permissions
SET permissions = permissions || jsonb_build_object(
  'referrers', COALESCE(permissions->'referrers', to_jsonb(ARRAY['create','read','update','delete','manage_pricelists']::text[])),
  'studies',   COALESCE(permissions->'studies',   to_jsonb(ARRAY['create','read','update','delete']::text[])),
  'packages',  COALESCE(permissions->'packages',  to_jsonb(ARRAY['create','read','update','delete']::text[]))
)
WHERE role_name='Administrador'
  AND (permissions ? 'studies') IS FALSE;

-- Recepcionista
UPDATE roles_permissions
SET permissions = permissions || jsonb_build_object(
  'referrers', COALESCE(permissions->'referrers', to_jsonb(ARRAY['read']::text[])),
  'studies',   COALESCE(permissions->'studies',   to_jsonb(ARRAY['read']::text[]))
)
WHERE role_name='Recepcionista'
  AND ((permissions ? 'studies') IS FALSE OR (permissions ? 'referrers') IS FALSE);

-- Laboratorista (no requiere 'studies') -> sin cambio.

COMMIT;
