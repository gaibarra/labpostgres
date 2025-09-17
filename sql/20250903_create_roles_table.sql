-- 20250903_create_roles_table.sql
-- Create roles table and seed default roles

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  role_name text unique not null,
  label text not null,
  color_class text not null
);

-- Insert default roles with display label and CSS classes
insert into roles (role_name, label, color_class) values
  ('Administrador', 'Administrador', 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'),
  ('Recepcionista', 'Recepcionista', 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300'),
  ('Laboratorista', 'Laboratorista', 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300')
on conflict (role_name) do update set
  label = excluded.label,
  color_class = excluded.color_class;
