-- 0009_align_roles_permissions_results.sql
-- Replica tenant-side: asegurar permisos críticos de órdenes para roles base.
-- Idempotente / no destructivo.
BEGIN;

-- Asegurar presencia de key 'orders'
UPDATE roles_permissions
SET permissions = permissions || jsonb_build_object(
  'orders', COALESCE(permissions->'orders', to_jsonb(ARRAY[]::text[]))
)
WHERE role_name IN ('Administrador','Laboratorista','Recepcionista');

-- Administrador
UPDATE roles_permissions
SET permissions = jsonb_set(
  permissions,
  ARRAY['orders'],
  (
    SELECT to_jsonb(ARRAY(SELECT DISTINCT unnest(cur || '{create,read_all,enter_results,update_status,validate_results,print_report,send_report}'::text[])))
    FROM (
      SELECT COALESCE(permissions->'orders','[]'::jsonb) AS cur_json
    ) s
    CROSS JOIN LATERAL (
      SELECT ARRAY(SELECT jsonb_array_elements_text(cur_json)) AS cur
    ) c
  )
)
WHERE role_name='Administrador';

-- Laboratorista
UPDATE roles_permissions
SET permissions = jsonb_set(
  permissions,
  ARRAY['orders'],
  (
    SELECT to_jsonb(ARRAY(SELECT DISTINCT unnest(cur || '{read_all,enter_results,update_status}'::text[])))
    FROM (
      SELECT COALESCE(permissions->'orders','[]'::jsonb) AS cur_json
    ) s
    CROSS JOIN LATERAL (
      SELECT ARRAY(SELECT jsonb_array_elements_text(cur_json)) AS cur
    ) c
  )
)
WHERE role_name='Laboratorista';

-- Recepcionista (sin enter_results)
UPDATE roles_permissions
SET permissions = jsonb_set(
  permissions,
  ARRAY['orders'],
  (
    SELECT to_jsonb(ARRAY(SELECT DISTINCT unnest(cur || '{create,read_all,update_status,print_report,send_report}'::text[])))
    FROM (
      SELECT COALESCE(permissions->'orders','[]'::jsonb) AS cur_json
    ) s
    CROSS JOIN LATERAL (
      SELECT ARRAY(SELECT jsonb_array_elements_text(cur_json)) AS cur
    ) c
  )
)
WHERE role_name='Recepcionista';

COMMIT;
