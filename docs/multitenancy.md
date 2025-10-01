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
