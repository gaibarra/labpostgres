# Flujo de Prueba Multi‑Tenant (DB por laboratorio)

Este documento describe paso a paso cómo probar el modo multi‑tenant actualmente implementado.

## 1. Preparar Variables de Entorno
Asegúrate de tener en tu `.env` (root o `server/`):
```
MULTI_TENANT=1
# Master (metadatos de tenants)
MASTER_PGHOST=localhost
MASTER_PGPORT=5432
MASTER_PGUSER=postgres
MASTER_PGPASSWORD=postgres
MASTER_PGDATABASE=lab_master
# (Opcional) Override distinto para tenants, si no se usan las mismas credenciales
TENANT_PGHOST=localhost
TENANT_PGPORT=5432
TENANT_PGUSER=postgres
TENANT_PGPASSWORD=postgres

JWT_SECRET=devsecret123   # O uno más fuerte
```
Si ya existían variables PG* globales, MASTER_* tiene prioridad para el master.

## 2. Crear Base Master (si no existe)
```
createdb lab_master || true
psql -d lab_master -f sql/20251001_create_tenant_master_schema.sql
```
Verifica que existan las tablas:
```
psql -d lab_master -c "\\dt"
```
Debes ver: `tenants`, `tenant_admins`, `tenant_events`, vista `active_tenants`.

## 3. Provisionar un Tenant
Ejecuta el script de provisión:
```
node server/scripts/provisionTenant.js \
  --slug=demo \
  --email=admin@demo.com \
  --password=Secret123
```
Salida esperada (resumen):
```
[PROVISION] Registrando tenant slug=demo db=lab_demo
[PROVISION] Listo. tenant_id=<uuid>
```
Esto crea (si no existe) la base `lab_demo`, registra el tenant y el admin.

Para crear otro tenant:
```
node server/scripts/provisionTenant.js --slug=beta --email=admin@beta.com --password=Secret123
```

## 4. Iniciar el Servidor
Si usas systemd ya configurado, reinicia el servicio. En modo directo:
```
node server/index.js
```
Log esperado:
```
[MT] Multi-tenancy habilitado
Servidor corriendo en el puerto 4100
```

## 5. Login (Admin Tenant)
Haz login con el admin creado:
```
curl -s -X POST http://localhost:4100/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","password":"Secret123"}' | jq
```
Verifica que la respuesta incluya `tenant_id` dentro del `token` (payload decodificado) y también en el objeto `user`:
```
{
  "user": {
    "id": "...",
    "email": "admin@demo.com",
    "role": "Administrador" | "owner" (según flujo futuro),
    "tenant_id": "<uuid>"
  },
  "token": "<jwt>"
}
```
(Actualmente el rol devuelto puede ser el básico; la tabla `tenant_admins` asigna rol `owner`, pero el login mezcla lógica heredada. Fase siguiente: armonizar roles.)

## 6. Usar el Token en Rutas con Middleware Tenant
Ejemplo (ruta `roles` ya pasa por `tenantMw`):
```
TOKEN=$(curl -s -X POST http://localhost:4100/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","password":"Secret123"}' | jq -r .token)

curl -s http://localhost:4100/api/roles \
  -H "Authorization: Bearer $TOKEN" | jq
```
Si la ruta responde sin error 401/NO_TENANT, el `tenantMw` recibió `tenant_id` correctamente.

## 7. Health Extendida
Revisa estado master y (opcional) un tenant:
```
curl -s "http://localhost:4100/api/health?master=1&tenant_id=<TENANT_UUID>" | jq
```
Respuesta esperada (ejemplo):
```
{
  "status": "ok",
  "dbLatencyMs": 4,
  "master": true,
  "tenant": true,
  "uptimeSeconds": 123
}
```
Si `tenant` = false, validar que el tenant exista y esté `status='active'` en `tenants`.

## 8. Segundo Tenant (Aislamiento Básico)
1. Provisiona: `--slug=beta --email=admin@beta.com`.
2. Login con `admin@beta.com`.
3. Compara consultas (una futura ruta de datos) para validar aislamiento. Por ahora, puedes inspeccionar conexiones abiertas en PostgreSQL:
```
SELECT datname, usename, COUNT(*) FROM pg_stat_activity WHERE datname LIKE 'lab_%' GROUP BY 1,2;
```

## 9. Limpieza / Revocación
Logout (revoca token):
```
curl -s -X POST http://localhost:4100/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" | jq
```
Nuevo acceso con el mismo token debe devolver 401.

## 10. Errores Comunes
| Problema | Causa | Solución |
|----------|-------|----------|
| 401 NO_TENANT | Falta `tenant_id` en JWT | Asegurar `MULTI_TENANT=1` y login de admin master |
| TENANT_NOT_FOUND | No existe en master | Revisar tabla `tenants` |
| TENANT_INACTIVE | status != active | `UPDATE tenants SET status='active' WHERE id=...;` |
| master=false en health | Credenciales master incorrectas | Verificar MASTER_* en `.env` |
| tenant=false en health | DB tenant inaccesible | Comprobar que la DB existe y permisos |

## 11. Próximos Pasos (Pendientes)
- Aplicar `tenantMw` a más rutas (patients, work-orders, etc.).
- Orquestador de migraciones por tenant (versión en `tenants.db_version`).
- Unificar roles `tenant_admins.role` con roles internos.
- Cache LRU y métricas etiquetadas por tenant.

## 12. Resumen Rápido
```
# 1. master schema
psql -d lab_master -f sql/20251001_create_tenant_master_schema.sql
# 2. provision
node server/scripts/provisionTenant.js --slug=demo --email=admin@demo.com --password=Secret123
# 3. run server (MULTI_TENANT=1 en .env)
node server/index.js
# 4. login
curl -X POST http://localhost:4100/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@demo.com","password":"Secret123"}'
# 5. roles (usa tenantMw)
curl http://localhost:4100/api/roles -H "Authorization: Bearer <TOKEN>"
# 6. health extendida
curl "http://localhost:4100/api/health?master=1&tenant_id=<TENANT_UUID>"
```

---
Este flujo se actualizará cuando se añada el orquestador de migraciones y más rutas multi-tenant.