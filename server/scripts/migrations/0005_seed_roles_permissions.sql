-- 0005_seed_roles_permissions.sql
-- Inserta roles base y permisos si la tabla está vacía.

BEGIN;

INSERT INTO roles (role_name, label, color_class)
VALUES
  ('Administrador','Administrador','bg-red-100 text-red-800'),
  ('Recepcionista','Recepcionista','bg-sky-100 text-sky-800'),
  ('Laboratorista','Laboratorista','bg-teal-100 text-teal-800')
ON CONFLICT (role_name) DO UPDATE SET
  label = EXCLUDED.label,
  color_class = EXCLUDED.color_class;

DO $$DECLARE cnt int; BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='roles_permissions') THEN
    SELECT COUNT(*) INTO cnt FROM roles_permissions;
    IF cnt = 0 THEN
      INSERT INTO roles_permissions (role_name, permissions, is_system_role) VALUES
        ('Administrador', jsonb_build_object(
          'patients', ARRAY['create','read','update','delete'],
            'referrers', ARRAY['create','read','update','delete','manage_pricelists'],
            'studies', ARRAY['create','read','update','delete'],
            'packages', ARRAY['create','read','update','delete'],
            'orders', ARRAY['create','read_all','enter_results','update_status','validate_results','print_report','send_report']
        ), true),
        ('Recepcionista', jsonb_build_object(
          'patients', ARRAY['create','read','update'],
          'referrers', ARRAY['read'],
          'studies', ARRAY['read'],
          'orders', ARRAY['create','read_all','update_status','print_report','send_report']
        ), true),
        ('Laboratorista', jsonb_build_object(
          'patients', ARRAY['read'],
          'orders', ARRAY['read_all','enter_results','update_status']
        ), true);
    END IF;
  END IF;
END$$;

COMMIT;
