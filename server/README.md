# Backend API (Migración Supabase -> Node/Express + PostgreSQL)

## Fechas Civiles (DOB y similares)
Las fechas de nacimiento y otras fechas "civiles" se manejan como strings `YYYY-MM-DD` (sin parseo a Date para evitar desplazamientos por TZ). Política completa: ver `../../docs/date_handling.md`.

## Endpoints Principales
Auth:
- POST /api/auth/register { email, password, full_name, role? }
- POST /api/auth/login { email, password }
- GET  /api/auth/me (Bearer token)

Pacientes:
- GET /api/patients?page&pageSize&search
- POST /api/patients
- GET /api/patients/:id
- PUT /api/patients/:id
- DELETE /api/patients/:id

Work Orders:
- GET /api/work-orders?page&pageSize&search
- POST /api/work-orders
- GET /api/work-orders/:id
- PUT /api/work-orders/:id
- DELETE /api/work-orders/:id

Usuarios (admin):
- DELETE /api/users/:id (permiso administration.manage_users)

Roles:
- GET /api/roles
- POST /api/roles
- PUT /api/roles/:role_name
- DELETE /api/roles/:role_name (no system role)

Perfiles:
- GET /api/profiles (permiso profiles:read)
- GET /api/profiles/:id (profiles:read o dueño)
- PATCH /api/profiles/:id (dueño o profiles:write)
- PATCH /api/profiles/:id/role (roles:assign)

Auditoría:
- GET /api/audit (permiso administration.view_audit_log)
- POST /api/audit (permiso administration.view_audit_log)

Marketing (placeholder):
- POST /api/marketing/generate (permiso marketing.access_marketing_tools)

Observabilidad:
- GET /api/health (estado y latencia DB)
- GET /api/metrics (Prometheus: http_request_duration_seconds + gauges pool)

### Análisis (estudios)

- GET /api/analysis?limit&offset&search
- GET /api/analysis/detailed
- GET /api/analysis/next-key
- GET /api/analysis/count
- GET /api/analysis/:id
- POST /api/analysis
- PUT /api/analysis/:id
- DELETE /api/analysis/:id

Validaciones clave:
- Categoría: se valida contra una lista permitida. Si la categoría no está autorizada se responde 400 INVALID_CATEGORY.
- Actualización sin cambios: si el body no contiene campos actualizables se responde 400 NO_UPDATE_FIELDS.

PUT /api/analysis/:id – mapeo de errores (resumen):
- 409 DUPLICATE_KEY: intento de asignar una clave/code ya existente (violación unique).
	- details: cuando es posible se incluye { field, value } a partir del detalle de Postgres.
- 400 DATA_CONSTRAINT_VIOLATION: falla una constraint de datos (check, etc.). Incluye detalle de constraint.
- 400 BAD_INPUT_SYNTAX: formato inválido para el tipo de dato (ej. texto en campo numérico).
- 400 NOT_NULL_VIOLATION: falta un campo requerido (not null).
- 400 FK_VIOLATION: referencia foránea inválida.
- 400 NO_UPDATE_FIELDS: no se proporcionaron campos para actualizar.
- 500 ANALYSIS_UPDATE_FAIL: error inesperado no clasificado en los casos anteriores.

Notas:
- La validación de categorías usa un allowlist centralizado (utils/analysisCategories.js). Si necesitas añadir una categoría, actualiza dicho archivo y acompáñalo de pruebas.
- El audit log registra create/update/delete en análisis y sus parámetros/rangos.

### Antibiograma (nuevo)

- GET /api/antibiotics
	- Permiso: studies:read
	- Query params: q, class, active(true/false), page, pageSize (max 200), sort(name|code)
	- Respuesta: { count, total, page, pageSize, items: [ { id, code, name, class, is_active, synonyms, updated_at } ] }

- GET /api/antibiotics/classes
	- Permiso: studies:read
	- Respuesta: { classes: [ { class, count } ] }

- GET /api/antibiogram/results?work_order_id=...&analysis_id=...&isolate_no=1
	- Permiso: orders:read
	- Respuesta: { items: [ fila por antibiótico con fields de antibiogram_results + antibiotic_code/name/class ] }

- POST /api/antibiogram/results
	- Permiso: orders:enter_results
	- Body:
		{
			work_order_id, analysis_id, isolate_no,
			organism, specimen_type, method, standard, standard_version,
			results: [ { antibiotic_code, measure_type: 'ZONE'|'MIC', value_numeric, unit, interpretation: 'S'|'I'|'R', comments } ]
		}
	- Upsert por (work_order_id, analysis_id, isolate_no, antibiotic_id).

- DELETE /api/antibiogram/results
	- Permiso: orders:enter_results
	- Body: { work_order_id, analysis_id, isolate_no, antibiotic_codes: [ 'CIP', ... ] }

## Permisos
Roles y permisos en tabla `roles_permissions` (JSONB). Middleware `requirePermission(module, action)` combina módulo + acción (ej. `profiles:read`).

## Variables de Entorno (.env)
Ver `.env.example`.

## Scripts
- npm run dev (nodemon)
- npm start
- npm test (vitest + supertest)
 - npm run test:coverage (coverage)
 - npm run import:antibiotics -- --db=lab_tenant --file=./antibiotics.json
	 - JSON: [ { code, name, class, is_active, synonyms:[...] }, ... ]

## Pasos Iniciales
1. Copiar `.env.example` a `.env` y ajustar credenciales.
2. Crear base de datos (ej: `createdb lab`).
3. Ejecutar migraciones iniciales (`psql -d lab -f ../sql/setup.sql` o consolidado).
4. `npm install` en `server/`.
5. `npm run dev`.
6. Verificar: `curl http://localhost:3001/api/health` y `curl http://localhost:3001/api/metrics`.
7. Registrar usuario: POST /api/auth/register.
8. (Tests) `npm test` – si DB no conecta se omiten algunos.

## Seguridad
Headers principales añadidos por Helmet / rate limiting:
- X-DNS-Prefetch-Control
- X-Frame-Options
- Strict-Transport-Security (si detrás de HTTPS)
- X-Content-Type-Options
- Referrer-Policy
- Cross-Origin-Resource-Policy
- RateLimit-* (RateLimit-Limit, RateLimit-Remaining...)

Logout / revocación:
- POST /api/auth/logout: token se agrega a blacklist en memoria hasta expirar.
- Token revocado => 401 (AUTH_REVOKED).

Para múltiples instancias: usar Redis compartido para blacklist.

### Protección de Información del Laboratorio (labInfo)
La sección `labInfo` ahora está protegida contra modificaciones accidentales:

- Cualquier intento de modificar campos de `labInfo` vía `PATCH /api/config` o `PUT /api/config` sin confirmación explícita devuelve **409 LABINFO_PROTECTED**.
- Para realizar un cambio deliberado se debe incluir `forceUnlock=true` (query param) o `{"forceUnlock": true}` en el body junto con los campos a actualizar.
- Enviar un objeto vacío `labInfo: {}` se ignora (no borra valores previos).
- Esta capa evita sobrescrituras silenciosas ocasionadas por formularios parciales o estados incompletos del frontend.

Ejemplo actualización legítima:
```
PATCH /api/config?forceUnlock=1
{
	"labInfo": { "phone": "555-9999" },
	"forceUnlock": true
}
```
Respuesta en caso de bloqueo (sin forceUnlock):
```json
{
	"error": "LABINFO_PROTECTED",
	"message": "Los campos de información del laboratorio están protegidos y no pueden modificarse sin confirmación explícita.",
	"details": { "intentados": ["phone"], "requiere": "forceUnlock=true" }
}
```

Para ampliar o ajustar los campos protegidos editar `PROTECTED_LABINFO_FIELDS` en `server/routes/config.js`.

## Próximas Mejoras
- Conectar middleware de auditoría a todas mutaciones (create/update/delete).
- Cobertura de tests para rutas de profiles (403 sin permiso).
- Blacklist distribuida (Redis) y verificación integrada.
- Retrys y resiliencia en escritura de audit_log.
- Scripts de migración automatizada (npm run migrate).
- Hardening adicional (CSP dinámica, límites por rol).
