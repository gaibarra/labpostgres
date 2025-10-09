-- 20251008_insert_laboratorista_role.sql
-- Inserta rol Laboratorista y sus permisos base si falta. Idempotente.
BEGIN;

INSERT INTO roles (role_name, label, color_class)
SELECT 'Laboratorista','Laboratorista','bg-teal-100 text-teal-800'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name='Laboratorista');

INSERT INTO roles_permissions (role_name, permissions, is_system_role)
SELECT 'Laboratorista', jsonb_build_object(
  'patients', to_jsonb(ARRAY['read']::text[]),
  'orders',   to_jsonb(ARRAY['read_all','enter_results','update_status']::text[])
), true
WHERE NOT EXISTS (SELECT 1 FROM roles_permissions WHERE role_name='Laboratorista');

COMMIT;
