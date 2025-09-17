# Backend API (Migración Supabase -> Node/Express + PostgreSQL)

## Endpoints Principales
Auth:
- POST /api/auth/register { email, password, full_name, role? }
- POST /api/auth/login { email, password }
- GET  /api/auth/me (Bearer token)

Pacientes:
- GET /api/patients?limit&offset&search
- POST /api/patients
- GET /api/patients/:id
- PUT /api/patients/:id
- DELETE /api/patients/:id

Work Orders:
- GET /api/work-orders?limit&offset&search
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

## Permisos
Roles y permisos en tabla `roles_permissions` (JSONB). Middleware `requirePermission(module, action)` combina módulo + acción (ej. `profiles:read`).

## Variables de Entorno (.env)
Ver `.env.example`.

## Scripts
- npm run dev (nodemon)
- npm start
- npm test (vitest + supertest)
 - npm run test:coverage (coverage)

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

## Próximas Mejoras
- Conectar middleware de auditoría a todas mutaciones (create/update/delete).
- Cobertura de tests para rutas de profiles (403 sin permiso).
- Blacklist distribuida (Redis) y verificación integrada.
- Retrys y resiliencia en escritura de audit_log.
- Scripts de migración automatizada (npm run migrate).
- Hardening adicional (CSP dinámica, límites por rol).
