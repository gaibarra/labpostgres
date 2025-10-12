# Prompt listo para IA: crear una app con el mismo stack y estructura, para otro dominio (no laboratorio)

Copia y pega este prompt en tu IA favorita. Reemplaza los marcadores entre <...> por tus valores.

---

Quiero que crees una aplicación web full‑stack completa con el MISMO stack tecnológico, estructura y convenciones que el proyecto de referencia, pero enfocada en el dominio <DOMINIO_NO_LABORATORIO>, llamada <NOMBRE_APP>.

- Stack y estructura de referencia
  - Frontend
    - React 18 + Vite
    - Tailwind CSS + PostCSS
    - shadcn/ui para componentes base
    - Vitest + React Testing Library
    - Estructura por módulos en `src/` (por funcionalidad); contextos en `src/contexts/`; hooks en `src/hooks/`; librerías en `src/lib/`
  - Backend (Node.js/Express)
    - Express con `routes/`, `middleware/`, `services/`, `validation/`, `utils/`
    - PostgreSQL con `server/db.js`
    - Autenticación por sesión/cookie; rutas `/api/auth/*`
    - Logging y métricas Prometheus (`/api/metrics`)
    - Pruebas con Vitest en `server/tests/`
  - Datos y migraciones
    - SQL en `/sql` y scripts en `server/scripts/`
  - DevOps/Despliegue
    - Nginx reverse proxy, servicio systemd y `deploy.sh`
  - Tooling
    - `.env` con dotenv, `package.json` en raíz y en `server/`, ESLint/Prettier, Vitest

- Objetivo
  - Entregar una app para <DOMINIO_NO_LABORATORIO> replicando la calidad y organización del proyecto, con entidades y flujos propios del nuevo dominio.

- Requisitos funcionales mínimos (adapta al dominio)
  1) Autenticación y roles (usuario + admin)
  2) CRUD de <ENTIDAD_PRINCIPAL> con validaciones
  3) Flujo operativo tipo “orden/tarea” (crear, listar, estados, notas)
  4) Dashboard/reportes (conteos, recientes, filtros, búsqueda)
  5) Catálogos auxiliares: <CATALOGO_A>, <CATALOGO_B>

- Requisitos no funcionales
  - Paginación/orden/filtros en GET
  - Validación consistente y códigos HTTP correctos
  - Logs de boot/peticiones; métricas `/api/metrics`; health `/api/health`
  - Seeds realistas y pruebas backend/frontend

- Estructura esperada del repo
  - Raíz: `index.html`, `package.json`, `postcss.config.cjs`, `tailwind.config.cjs`, `vite.config.js`, `vitest.config.js`, `setupTests.js`
  - `public/` assets
  - `src/`
    - `App.jsx`, router si aplica
    - `components/modules/<feature>/...`
    - `contexts/` (p. ej., `AuthProvider`)
    - `lib/` (`apiClient.js`, helpers por recurso)
  - `server/`
    - `index.js`, `db.js`, `logger.js`, `metrics.js`
    - `routes/`, `middleware/`, `services/`, `utils/`, `validation/`, `tests/`, `scripts/`
    - `package.json`, `vitest.config.js`, `README.md`
  - `sql/` migraciones/seeds `YYYYMMDD_*.sql`
  - `deploy/` Nginx + systemd + `deploy.sh`
  - `docs/` manuales de usuario/operación

- Modelo de datos de ejemplo para <DOMINIO_NO_LABORATORIO>
  - <ENTIDAD_PRINCIPAL> (CRUD, estados, notas, adjuntos opcional)
  - <ENTIDAD_SECUNDARIA> (relación N:1 o N:N)
  - Catálogos: <CATALOGO_A>, <CATALOGO_B>
  - Estados: `Pendiente`, `En proceso`, `Completada`, `Cancelada`

- Backend solicitado
  - Conexión PostgreSQL (pool + healthcheck)
  - Middlewares seguridad (CORS/helmet), JSON, cookies/sesiones
  - Auth: `POST /api/auth/register|login|logout`, `GET /api/auth/me`
  - CRUD de <ENTIDAD_PRINCIPAL> y catálogos con:
    - GET paginado: `?q=&page=&pageSize=&sort=`
    - POST/PUT/PATCH/DELETE con validaciones claras
  - Métricas `/api/metrics` y health `/api/health`
  - Pruebas de auth, CRUD, filtros, permisos

- Frontend solicitado
  - UI con shadcn/ui + Tailwind
  - Contexto de auth y hooks `useAuth`
  - Páginas: login, dashboard, listado/edición de <ENTIDAD_PRINCIPAL>, catálogos
  - Tabla con paginación/orden/filtros, formularios con validación, toasts
  - API client en `src/lib/apiClient.js` + helpers `src/lib/<entidad>Api.js`
  - Pruebas de render/interacción y estados vacíos

- Migraciones y seeds
  - Tablas: usuarios/roles, <ENTIDAD_PRINCIPAL>, <ENTIDAD_SECUNDARIA>, catálogos
  - Índices para búsqueda (`ILIKE`/`to_tsvector`) y FKs con `ON DELETE`
  - Seeds razonables y script `server/scripts/provisionTenant.js` (o similar)

- Multi-tenant y creación de tenants
  - Modelo
    - Base de datos master con tablas `tenants`, `tenant_admins`, `tenant_events`.
    - Un esquema por tenant: DB dedicada por slug (`<prefijo>_<slug>`), o en su defecto schema por tenant si decides esa variante.
  - Variables de entorno
    - MASTER_PGHOST, MASTER_PGPORT, MASTER_PGUSER, MASTER_PGPASSWORD, MASTER_PGDATABASE (DB master)
    - TENANT_PGHOST, TENANT_PGPORT, TENANT_PGUSER, TENANT_PGPASSWORD (creación/aplicación de migraciones en tenants)
  - Script CLI de aprovisionamiento
    - `node server/scripts/provisionTenant.js --slug=<slug> --email=<admin_email> --password=<password> [--plan=<plan>]`
    - Responsabilidades:
      1) Crear la DB del tenant (`createdb <prefijo>_<slug>`), tolerando existencia previa.
      2) Aplicar migraciones SQL ordenadas a la DB del tenant (`server/scripts/migrations/*.sql` y/o `sql/tenant_migrations`).
      3) Ejecutar seeds iniciales (catálogos, estudios/base de datos del dominio) y backfills idempotentes.
      4) Registrar el tenant en la DB master (`tenants`, `tenant_admins`) y emitir un evento `provisioned`.
      5) Verificar columnas/roles críticos y reparar en modo `--autofix`.
  - Aislamiento y routing
    - Cada request debe resolverse contra la pool del tenant derivada de `slug` (en cabecera, subdominio o sesión) con verificación de permisos.
    - Sin cross-tenant por defecto; auditoría registra `tenant_id` en eventos relevantes.
  - Endpoints tenant-aware
    - Todos los endpoints bajo `/api/*` deben extraer contexto de tenant y usar la conexión correspondiente.
    - Agrega `GET /api/tenants/:slug/health` y `POST /api/tenants (admin)` para crear desde panel, que delega al script o función equivalente.
  - Observabilidad
    - Métricas por tenant (labels con `tenant_slug`) y logs con trazabilidad `[TENANT:<slug>]`.
  - Criterios de aceptación (tenant)
    1) Crear un tenant con el CLI registra filas en master y crea/aplica migraciones en su DB.
    2) Al iniciar sesión con el admin creado, las rutas privadas operan sobre la DB del tenant.
    3) Reintentos idempotentes no rompen estado (migraciones/seeds toleran existencia previa).
    4) Métricas y logs incluyen el `tenant_slug`.

- Despliegue/operaciones
  - Nginx (`/deploy/nginx-<APP>.conf`), systemd (`<app>.service`), `deploy.sh`
  - README con pasos: `.env`, migraciones, start prod, métricas y logs

- Calidad y verificación
  - Scripts npm: `dev`, `build`, `lint`, `test`, `start`, `seed`, `migrate`
  - Quality gates: Build PASS, Lint PASS, Tests PASS

- Convenciones
  - Misma organización y nombres de carpetas
  - Reutiliza patrones de validación, errores, logging, métricas, setup de tests

- Entregables
  - Código completo con la estructura indicada
  - >=5 pruebas backend y >=3 frontend
  - SQL de migraciones + seeds
  - Archivos de despliegue y README(s) en `/deploy` y `/server`
  - `docs/` con manual de usuario y guía de operación

- Parámetros para reemplazar
  - <NOMBRE_APP>, <DOMINIO_NO_LABORATORIO>, <ENTIDAD_PRINCIPAL>, <ENTIDAD_SECUNDARIA>, <CATALOGO_A>, <CATALOGO_B>

- Criterios de aceptación
  1) Dev corre con `npm run dev` (frontend) y `server/`
  2) Auth funciona y protege rutas privadas
  3) CRUD de <ENTIDAD_PRINCIPAL> con filtros/paginado/búsqueda
  4) Dashboard con conteos y recientes
  5) Build/Lint/Tests en verde

Genera todo el código y archivos necesarios, manteniendo la estructura y convenciones solicitadas. Evita dependencias exóticas y documenta decisiones relevantes en README.

---

## Consejos
- Define primero los marcadores (<...>) y pega el prompt completo
- Para módulos extra, extiende siguiendo el mismo patrón (rutas, UI, pruebas, migraciones)
- Pide seeds con datos creíbles para demo
