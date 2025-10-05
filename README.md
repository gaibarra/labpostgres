# labpostgres

## Política de Fechas (Civil Dates)
Para fechas civiles (actualmente `patients.date_of_birth`) se aplica una política estricta: siempre `YYYY-MM-DD` sin zona horaria ni hora. Ver detalles completos en `docs/date_handling.md`.

## Documentación de Configuración y Seguridad de Secretos
La aplicación implementa un mecanismo de masking y metadatos para llaves API (OpenAI, Deepseek, etc.) evitando exponer valores completos en respuestas estándar.

Detalles completos del contrato, flujo de rotación/borrado y estructura de `_meta`:

Ver: `docs/config_secrets_masking.md`

Resumen rápido:

Próximos pasos planeados: endpoint admin dedicado para valores completos y pruebas adicionales de auditoría.


## Seguridad / Configuración Avanzada

### Secretos e Integraciones
Los campos sensibles (por ejemplo `openaiApiKey`) se almacenan en la tabla de configuración y se manejan con las siguientes reglas:
* En respuestas normales para usuarios no administradores se devuelven enmascarados (`sk-****1234`).
* Para administradores existe el endpoint `GET /api/config/integrations` que expone el valor completo y metadatos (`updatedAt`, `updatedBy`, `last4`, `removedAt`, `removedBy`).
* Semántica de actualización:
	* Omitir un campo => se conserva.
	* Enviar `null` => se elimina y se registra metadata de remoción.
	* Enviar nuevo valor string => rotación (actualiza metadata y `last4`).

### Metadatos de Secretos
Se guardan en una estructura `integrations_meta` (jsonb) con claves espejo de los secretos. Cada objeto incluye timestamps y usuario (ID / email si disponible) para auditoría ligera.

### Redacción y Logs
El logger (Pino) aplica redacción de cabeceras sensibles (`authorization`, `cookie`). Además, antes de registrar configuraciones se pasa por un util central (`redactSecrets`) que reemplaza valores sensibles por máscaras para evitar exposición en logs.

### Rate Limiting
Operaciones de mutación sobre configuración (`PATCH/PUT /api/config`, `PATCH /api/config/integrations`) usan rate limiting (ej. 30 req / 5 min por IP) para reducir intentos de fuerza bruta o exfiltración incremental.

### Validación de Formato de Secretos
Endpoint: `POST /api/config/integrations/validate?field=openaiApiKey` permite validar formato de API keys (patrones conocidos) sin almacenarlas todavía. Útil para UX previa al guardado definitivo.

### Rotación Multi‑Secret
El sistema soporta múltiples campos secretos definidos en una lista central `SECRET_FIELDS`. Las pruebas incluyen rotación secuencial preservando metadatos independientes (updatedAt/By individual). Agregar un nuevo secreto sólo requiere añadirlo a la constante y ajustar UI si procede.

### Autenticación Híbrida (Bearer + Cookie)
`/api/auth/login` devuelve token JWT en JSON y además setea cookie `auth_token` httpOnly (12h). El middleware de autenticación acepta:
* Authorization: `Bearer <jwt>`
* Cookie httpOnly `auth_token`

`/api/auth/logout` limpia la cookie y revoca (blacklist) el token bearer si fue enviado. Esto habilita migrar progresivamente a sesiones basadas en cookie (mitiga exposición en JS y reduzca riesgo de exfiltración por XSS parcial).

### Omission vs Null Contract (Resumen)
| Acción | Payload | Resultado |
|--------|---------|-----------|
| Mantener secreto | (no incluir clave) | Sin cambios |
| Eliminar secreto | `"clave": null` | Borra valor + registra removedAt/By |
| Rotar secreto | `"clave": "nuevo"` | Actualiza valor + updatedAt/By + last4 |

### Tests de Seguridad Clave
* Redacción de secretos (`secrets.redact.test.js`).
* Rotación y metadatos multi‑secret.
* Endpoint admin sin alias legado (no se expone `openAIKey`).
* Validación de formato de secreto (integrations/validate).
* Cookie httpOnly login + acceso protegido + logout.
* Limites de rate en configuración (implícito: cabeceras `ratelimit-*`).

### Próximos Pasos Recomendados
1. Añadir expiración anticipada / refresh tokens si se requiere sesiones >12h.
2. Registrar intentos fallidos de validación de secreto para detección temprana.
3. Integrar almacenamiento de blacklist en Redis para escalado horizontal.

### Revocación estricta de tokens
`/api/auth/logout` ahora siempre inserta en la blacklist el JWT utilizado en la solicitud (sea por Bearer header o cookie). El middleware unificado guarda el token crudo en `req.authToken` y el logout lo decodifica (sin verificar nuevamente) para obtener `exp` y registrar su expiración natural. Tras esto:

* La cookie previa queda inservible aunque el cliente la reenvíe.
* El header Bearer con el token ya usado recibe 401 `TOKEN_REVOKED`.
* La respuesta incluye `{ revoked: true }` para diagnóstico ligero.

Test asociado: `server/tests/auth.cookie.reuse-after-logout.test.js` (impide reutilización de cookie post-logout).

Mejora futura (opcional): versionar sesiones por usuario (columna `token_version`) y compararla en middleware para invalidar masivamente todos los tokens ante eventos críticos (reset de contraseña, cambio global de permisos sensitivos).

### Gestión avanzada de tokens (Redis + jti + token_version)
Se añadió un sistema de tracking y revocación granular:

* Cada JWT incluye `jti` (identificador único) y `tv` (token_version del usuario en emisión).
* `token_version` vive en la tabla `users` y permite invalidar todos los tokens previos incrementando su valor (p.ej. tras reset de contraseña masivo).
* Al login / registro se registra el token en una lista de activos (en Redis si `REDIS_URL` definido; fallback a memoria durante desarrollo/testing).
* Revocación en logout: añade el token completo y el `jti` a blacklist y elimina de activos.
* Endpoint admin:
	* `GET /api/auth/admin/tokens` lista tokens activos (opcional `?userId=`).
	* `POST /api/auth/admin/tokens/revoke { jti }` revoca manualmente.

#### Redis (opcional pero recomendado en multi-instancia)
Si se define `REDIS_URL`, las claves usadas:
* `active:jti:<jti>` -> JSON `{ userId, exp, tokenVersion, issuedAt }` (TTL = exp natural)
* `blacklist:token:<token>` -> marcador simple TTL
* `blacklist:jti:<jti>` -> marcador simple TTL

Fallback memoria mantiene estructuras equivalentes (no persistentes) en `tokenStore._memory`.

#### Métricas Prometheus añadidas
* `auth_token_revocations_total{reason}` (reason: `logout`, `admin_manual`, etc.)
* `auth_token_version_mismatch_total`
* `auth_token_jti_blacklist_hits_total`

Estas exponen visibilidad en caducidades activas vs revocaciones tempranas y ayudan a detectar abuso (incremento anómalo en revocaciones manuales).

#### Flujo de invalidación masiva
Para invalidar todo lo anterior a un evento crítico:
1. `UPDATE users SET token_version = token_version + 1 WHERE id = <user>;`
2. Tokens antiguos (tv desfasada) serán rechazados con `TOKEN_VERSION_MISMATCH`.
3. Opcional: revocar jtis activos listados para acelerar limpieza (aunque ya no son aceptados).

## Multi-Tenancy (una base de datos por laboratorio)

Modo opcional activando `MULTI_TENANT=1` en `.env`. Requiere una base "master" que contiene:
* `tenants` (slug, db_name, estado, plan, versión de migración)
* `tenant_admins` (credenciales de acceso iniciales/owners)
* `tenant_events` (auditoría de provisión, cambios de plan, suspensiones, etc.)

### Variables de entorno clave
```
MULTI_TENANT=1
MASTER_PGHOST=localhost
MASTER_PGPORT=5432
MASTER_PGUSER=postgres
MASTER_PGPASSWORD=postgres
MASTER_PGDATABASE=lab_master
TENANT_PGHOST=localhost
TENANT_PGPORT=5432
TENANT_PGUSER=postgres
TENANT_PGPASSWORD=postgres
```

### Inicialización del esquema master
```
psql -d lab_master -f sql/20251001_create_tenant_master_schema.sql
```

### Provisionar un laboratorio
```
node server/scripts/provisionTenant.js --slug=demo --email=admin@demo.com --password=Secret123
```
Genera (si no existe) la DB `lab_demo`, crea estructura mínima y registra el tenant + admin.

### Login multi-tenant
`/api/auth/login` ahora, si `MULTI_TENANT=1`, busca primero en `tenant_admins` de la master. Si encuentra credenciales válidas, el JWT incluye `tenant_id`. Las rutas protegidas con middleware `tenantMiddleware` reciben `req.tenantPool` apuntando a la DB del laboratorio.

### Health extendido
`GET /api/health?master=1&tenant_id=<id>` devuelve estado master y (opcional) del tenant.

### Próximos pasos sugeridos
1. Orquestador de migraciones por tenant (recorre `active_tenants`).
2. Métricas por tenant (con etiquetas `tenant_id`).
3. Rotación / suspensión (`status` en `tenants`).
4. Límite de pools simultáneos y LRU para entornos de alta cardinalidad.


## Modales Persistentes y Plan de Rollback

Para reducir errores `NotFoundError: removeChild` ocasionados por desmontajes rápidos de portales Radix, se adoptó un patrón de montaje persistente en los modales de órdenes.

Flags de entorno (frontend Vite):
```
VITE_PERSISTENT_MODALS=on   # (default) Usa montaje persistente
VITE_PERSISTENT_MODALS=off  # Fuerza modo legacy condicional
VITE_DIALOG_OBSERVER=on     # Activa MutationObserver de diagnóstico
```

El observer (cuando `VITE_DIALOG_OBSERVER=on`) registra en consola eventos `[DialogObserver][removed subtree]` con IDs de contenidos desmontados para rastrear detach inesperados.

Rollback rápido:
1. Establecer `VITE_PERSISTENT_MODALS=off` en el entorno.
2. Rebuild / redeploy.
3. Verificar desaparición de logs continuos de montaje y ausencia de nuevos `NotFoundError`.

Si el error sólo desaparece en legacy, revisar secuencia de apertura/cierre encadenada para aislar un caso que aún provoque doble removeChild.


