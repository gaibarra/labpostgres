# Tabla analysis_reference_ranges

Nueva tabla creada en migración 0006 para desacoplar los rangos modernos del catálogo legacy.

## Objetivo
Evitar conflicto de FK entre `reference_ranges` (legacy -> parameters) y los parámetros modernos (`analysis_parameters`).

## Esquema
```
analysis_reference_ranges (
  id uuid PK,
  parameter_id uuid FK -> analysis_parameters(id) ON DELETE CASCADE,
  sex text NULL,
  age_min integer NULL,
  age_max integer NULL,
  age_min_unit text DEFAULT 'años',
  lower numeric NULL,
  upper numeric NULL,
  text_value text NULL,
  notes text NULL,
  unit text NULL,
  created_at timestamptz DEFAULT now()
)
```

## Uso en backend
- `routes/analysis.js` detecta si existe la tabla; si sí, la usa en lugar de `reference_ranges`.
- `seedDefaultStudies.js` inserta rangos aquí sólo en modo moderno.

## Migración / Provisioning
- Aplicar migraciones: asegurarse que 0006 se ejecute antes del seed moderno.
- Tenants antiguos pueden backfillear copiando rangos manuales si lo desean.

## Compatibilidad
- Si la tabla no existe el backend continúa usando `reference_ranges` (legacy).
- UI no requiere cambios: endpoint /api/analysis ahora selecciona dinámicamente.

