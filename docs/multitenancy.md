## Multi-tenant (una base de datos por laboratorio)

### Componentes
- Base maestra: almacena `tenants`, `tenant_admins`, eventos y versiones.
- Bases por laboratorio: datos de negocio aislados.
- Módulo `tenantResolver.js`: resuelve `tenantId` -> pool PostgreSQL.

### Variables de entorno sugeridas
```
MASTER_PGHOST=127.0.0.1
MASTER_PGPORT=5432
MASTER_PGUSER=postgres
MASTER_PGPASSWORD=CHANGEME
MASTER_PGDATABASE=lab_master
TENANT_PGHOST=127.0.0.1
TENANT_PGPORT=5432
TENANT_PGUSER=postgres
TENANT_PGPASSWORD=CHANGEME
```

### Flujo de autenticación
1. Login contra DB maestra (tabla `tenant_admins`).
2. JWT retorna `tenant_id`.
3. Middleware adjunta `req.tenantPool`.
4. Repositorios / servicios usan `req.tenantPool.query(...)`.

#### ¿Y si el admin vive únicamente en la DB del tenant?
- Durante la migración hacia el modelo multi-tenant es común que los usuarios existan sólo en la base del laboratorio (por ejemplo `lab_demo`).
- El backend ahora intenta deducir el `tenant_id` cuando la búsqueda en `tenant_admins` no arroja resultados pero el usuario sí existe en la DB por defecto (`PGDATABASE`).
- Para que la detección automática funcione se necesita al menos uno de los siguientes *hints* configurados y un registro en `tenants` que coincida:
	- `DEFAULT_TENANT_ID` → UUID exacto del tenant.
	- `SINGLE_TENANT_SLUG` → slug registrado (citext) en la tabla `tenants`.
	- `DEFAULT_TENANT_DB` → nombre de la base del laboratorio (ej. `lab_demo`). Si no se define, el sistema usa `PGDATABASE` como último recurso.
- Recomendado: después de ejecutar `initMaster.sh` y registrar el tenant (o recrearlo con `provisionTenant.js`), añade el hint correspondiente en `.env`. Ejemplo:

```
DEFAULT_TENANT_DB=lab_demo
# opcional si ya conoces el UUID
# DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000000
```
- Una vez resuelto el tenant, el JWT incluirá `tenant_id` incluso para cuentas existentes, habilitando las rutas protegidas que dependen de `tenantMiddleware`.

### Provisionamiento (resumen)
1. Crear DB: `CREATE DATABASE lab_tenant_<slug> TEMPLATE lab_template;` (o correr migraciones).
2. Registrar: `registerTenant({ slug, dbName, adminEmail, passwordHash })`.
3. (Opcional) Ejecutar migrador central que actualiza todas las DBs a la versión requerida.

### Migraciones
Registrar versión aplicada en `tenants.db_version`. Antes de servir petición, comparar con versión actual del código.

### Seguridad
- Nunca interpolar nombres de DB a partir de input sin validación; siempre leer desde la tabla maestra.
- Rotar contraseñas de usuario DB global si se comparte; mejor usar roles dedicados por tenant si el número es bajo.

### Limpieza / Offboarding
1. Marcar `status='deleting'`.
2. Exportar dump.
3. DROP DATABASE.
4. Eliminar fila en `tenants` (cascade limpia admins / events).

### Monitoreo
- Métricas por tenant: uso de conexiones, latencia, errores.
- Alerta si `tenantPools.size` excede umbral (ej. 200) -> aplicar LRU y cerrar pools inactivos.

### Próximos pasos
- Integrar middleware en `server/index.js`.
- Crear script de migraciones global.
- Añadir endpoint `/api/tenants/:id/health` que use `masterHealth`.
