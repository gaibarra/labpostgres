-- 006_referring_entities_normalize.sql
-- Versión PLANA idempotente (sin DO). Apta para entornos con migrador simple.

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.referring_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  entity_type text,
  specialty text,
  email text,
  phone_number text,
  address text,
  listaprecios jsonb,
  created_at timestamptz DEFAULT now()
);

-- Asegurar columnas (no falla si ya existen)
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS specialty text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS listaprecios jsonb;
ALTER TABLE public.referring_entities ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Migrar datos desde referrers sólo si tabla origen y destino vacío
INSERT INTO referring_entities(id,name,entity_type,email,phone_number,created_at)
SELECT r.id, r.name, r.entity_type, r.email, r.phone, COALESCE(r.created_at, now())
FROM referrers r
WHERE NOT EXISTS (SELECT 1 FROM referring_entities LIMIT 1)
ON CONFLICT DO NOTHING;

-- Índice / unicidad (índice único en name)
CREATE UNIQUE INDEX IF NOT EXISTS referring_entities_name_key ON referring_entities(name);

-- NOT NULL en name si no hay NULL (evitar fallo si sí hay)
ALTER TABLE referring_entities ALTER COLUMN name SET NOT NULL;

-- Semilla 'Particular'
INSERT INTO referring_entities(name, entity_type)
VALUES ('Particular','individual')
ON CONFLICT (name) DO NOTHING;
