-- 20251008_align_roles_permissions_results.sql
-- Asegura que los roles tengan permisos consistentes para flujo de resultados.
-- Idempotente y no destructiva: sólo añade acciones faltantes en módulo 'orders'.
-- Contexto: Se agregó lógica runtime que auto-completa permisos de Laboratorista. Esta migración lo formaliza en BD.

BEGIN;

-- Asegurar keys base 'orders' existen para roles clave
UPDATE roles_permissions
SET permissions = permissions || jsonb_build_object(
  'orders', COALESCE(permissions->'orders', to_jsonb(ARRAY[]::text[]))
)
WHERE role_name IN ('Administrador','Laboratorista','Recepcionista');

-- Administrador: merge acciones críticas si alguna falta
UPDATE roles_permissions
SET permissions = jsonb_set(
  permissions,
  ARRAY['orders'],
  (
    SELECT to_jsonb(ARRAY(SELECT DISTINCT unnest( current_actions || '{create,read_all,enter_results,update_status,validate_results,print_report,send_report}'::text[] ) ))
    FROM (
      SELECT COALESCE(permissions->'orders', '[]'::jsonb) AS cur
    ) s
    CROSS JOIN LATERAL (
      SELECT ARRAY(SELECT jsonb_array_elements_text(s.cur)) AS current_actions
    ) ca
  )
)
WHERE role_name='Administrador';

-- Laboratorista: asegurar read_all, enter_results, update_status
UPDATE roles_permissions
SET permissions = jsonb_set(
  permissions,
  ARRAY['orders'],
  (
    SELECT to_jsonb(ARRAY(SELECT DISTINCT unnest( current_actions || '{read_all,enter_results,update_status}'::text[] ) ))
    FROM (
      SELECT COALESCE(permissions->'orders', '[]'::jsonb) AS cur
    ) s
    CROSS JOIN LATERAL (
      SELECT ARRAY(SELECT jsonb_array_elements_text(s.cur)) AS current_actions
    ) ca
  )
)
WHERE role_name='Laboratorista';

-- Recepcionista: asegurar create, read_all, update_status, print_report, send_report (no enter_results)
UPDATE roles_permissions
SET permissions = jsonb_set(
  permissions,
  ARRAY['orders'],
  (
    SELECT to_jsonb(ARRAY(SELECT DISTINCT unnest( current_actions || '{create,read_all,update_status,print_report,send_report}'::text[] ) ))
    FROM (
      SELECT COALESCE(permissions->'orders', '[]'::jsonb) AS cur
    ) s
    CROSS JOIN LATERAL (
      SELECT ARRAY(SELECT jsonb_array_elements_text(s.cur)) AS current_actions
    ) ca
  )
)
WHERE role_name='Recepcionista';

COMMIT;

-- Verificación sugerida:
-- SELECT role_name, permissions->'orders' AS order_perms FROM roles_permissions WHERE role_name IN ('Administrador','Laboratorista','Recepcionista');
