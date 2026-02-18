-- Add quotes permissions to roles_permissions
BEGIN;

UPDATE roles_permissions
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{quotes}', '["create","read","update","delete","send","accept","extend","view_history"]'::jsonb, true)
WHERE role_name = 'Administrador';

UPDATE roles_permissions
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{quotes}', '["create","read","update","send","extend","view_history"]'::jsonb, true)
WHERE role_name = 'Recepcionista';

UPDATE roles_permissions
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{quotes}', '["read","view_history"]'::jsonb, true)
WHERE role_name IN ('Laboratorista','Técnico de Laboratorio','Flebotomista');

COMMIT;
