# Guía: Crear un nuevo tenant (laboratorio)

Esta guía explica paso a paso cómo crear un tenant nuevo, qué hace cada comando y cómo verificar que los estudios base quedaron cargados.

---
## 1. ¿Qué es un tenant?
Un *tenant* es una instancia lógica (base de datos propia) para un laboratorio. Cada tenant tiene:
- Su propia base PostgreSQL (ej: `lab_milab`)
- Un usuario administrador inicial
- Estudios y parámetros precargados (paneles clínicos comunes)

---
## 2. Prerrequisitos
1. Tener variables de conexión PostgreSQL configuradas (en `.env` o exportadas):
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`
   - `MASTER_PGDATABASE` (por defecto `lab_master` si no se especifica)
2. El rol de PostgreSQL debe poder crear bases de datos (o la DB ya existir).
3. Node.js instalado (v18+ recomendado).

---
## 3. Estructura relevante
```
server/scripts/provisionTenant.js                 # Script principal de aprovisionamiento
server/scripts/migrations/0001_core_schema.sql    # Tablas base mínimas (studies/parameters/reference_ranges)
server/scripts/migrations/0002_domain_core.sql    # Dominio inicial (patients, work_orders básicos, analysis catálogo paralelo)
server/scripts/migrations/0003_full_domain_extension.sql  # Tablas extendidas (marketing, precios, loyalty, perfiles, auditoría, etc.)
server/scripts/migrations/0004_security_policies.sql      # Funciones permisos y RLS / policies
server/scripts/migrations/0005_seed_roles_permissions.sql # Seed roles y permisos base
server/scripts/migrations/0006_analysis_reference_ranges.sql # Tabla moderna de rangos (analysis_reference_ranges)
server/scripts/migrations/0007_analysis_add_metadata.sql     # Metadatos adicionales en analysis (description, indications, sample_type...)
server/scripts/seedDefaultStudies.js              # Inserta estudios y parámetros base
```

> Nota: `sql/setup.sql` queda como script legacy para instalaciones anteriores. Ya no se aplica automáticamente si existen migraciones 0003+.

---
## 4. Qué hace el script `provisionTenant.js`
Orden simplificado de operaciones:
1. (Master) Inserta/actualiza registro del tenant (tabla `tenants`) y crea admin.
2. Crea la base de datos del tenant (`lab_<slug>`) si no existe.
3. Conecta a esa nueva base y aplica cada archivo SQL de `scripts/migrations` en orden (0001, 0002, ...).
   - 0001 crea tablas básicas: `studies`, `parameters`, `reference_ranges`, `_tenant_bootstrap`.
   - 0002 crea todo el dominio: `patients`, `analysis*` (catálogo paralelo si se usa), `work_orders`, `work_order_items`, `branches`, `referrers`, `packages`, `templates`, índices y triggers de `updated_at`.
4. Ejecuta el *seed* (`seedDefaultStudies.js`) que inserta ~14 estudios predefinidos con sus parámetros y rangos.
   - Después del seed, todos los análisis cuyo nombre inicia con “Perfil …” se convierten automáticamente en registros de `analysis_packages` con sus ítems (`analysis_package_items`), por lo que ya aparecen como Paquetes desde el primer arranque.
   - Si existe la migración 0006 se usarán `analysis_reference_ranges` para el catálogo moderno (`analysis` / `analysis_parameters`).
   - Si además está aplicada la 0007 se poblarán (cuando se definan en el array PANELS) campos descriptivos opcionales: description, indications, sample_type, sample_container, processing_time_hours, general_units.
5. Registra un evento `tenant_provisioned`.

Si algo falla en migraciones o seed, se muestra un aviso pero la creación puede continuar; debes revisar logs.

---
## 5. Crear un nuevo tenant (full domain listo)
El comando NO cambia tras la migración 0006; simplemente ahora se crea también la tabla `analysis_reference_ranges` y el backend la detecta automáticamente.
Ejecuta (desde la **raíz** del repositorio):
```bash
node server/scripts/provisionTenant.js --slug=hematos --email=admin@hematos.com --password='ClaveSegura123!'
```
Parámetros:
- `--slug`: identificador corto (se usa para construir el nombre de la DB: `lab_<slug>`)
- `--email`: correo del administrador inicial
- `--password`: contraseña inicial (se almacena con hash)
- `--plan` (opcional): plan comercial (`standard`, `premium`, etc.)

Ejemplo con plan:
```bash
node server/scripts/provisionTenant.js --slug=milab --email=admin@milab.com --password='Pass2025*' --plan=premium
```

> Nota: Si ejecutas el script **estando ya dentro** de `server/scripts`, NO repitas la ruta. Usa:
> ```bash
> node provisionTenant.js --slug=hematos --email=admin@hematos.com --password='ClaveSegura123!'
> ```
> Error típico: `Cannot find module .../server/scripts/server/scripts/provisionTenant.js` → ruta duplicada.

### 5.1 Limpiar paquetes "test" en cualquier tenant
Si detectas paquetes marcados como "test" (por ejemplo, usados para QA), elimínalos directamente en la base del tenant (`lab_<slug>`). Los ítems relacionados se borran en cascada gracias a la FK `ON DELETE CASCADE` hacia `analysis_package_items`.

```bash
DB=lab_milab   # reemplaza por la base del tenant
# Listar paquetes sospechosos
psql "$DB" -c "SELECT id, name, description FROM analysis_packages WHERE name ILIKE '%test%' OR description ILIKE '%test%';"

# Eliminar los paquetes de prueba
psql "$DB" -c "DELETE FROM analysis_packages WHERE name ILIKE '%test%' OR description ILIKE '%test%';"
```

> Ajusta el filtro si tus paquetes de prueba usan otra convención (por ejemplo `slug` o `price IS NULL`).

### 5.2 Re-sincronizar los paquetes "Perfil" con estudios individuales
Para cualquier tenant aprovisionado antes de esta actualización, si los paquetes tipo Perfil muestran "Estudio desconocido" en la UI, vuelve a enlazarlos con los estudios individuales ejecutando:

```bash
DB=lab_milab   # reemplaza por la base del tenant
node server/scripts/seedSingleParameterStudies.js --db="$DB"
node server/scripts/seedDefaultStudies.js --db="$DB"
```

El primer comando asegura que existan los análisis individuales (TSH, Creatinina, etc.). El segundo limpia ítems huérfanos, crea los estudios faltantes si es necesario y vuelve a poblar `analysis_package_items` mapeando cada parámetro del Perfil al estudio correspondiente. Después de correr ambos comandos, los paquetes mostrarán todos los componentes (mismo número de parámetros que el Estudio) y la UI listará los nombres reales en "Items incluidos".

---
## 6. Verificar que se sembraron los estudios y el dominio
Una vez creado el tenant (ejemplo `hematos` → DB `lab_hematos`):
```bash
psql lab_hematos -c "SELECT COUNT(*) AS estudios FROM studies;"
psql lab_hematos -c "SELECT name, category FROM studies ORDER BY name LIMIT 10;"
```
Deberías ver los estudios como: Biometría Hemática, Perfil Tiroideo, Perfil Hepático, etc.

Verifica también que existen las tablas de dominio:
```bash
psql lab_hematos -c "\dt"
```
Debes encontrar al menos:
```
_tenant_bootstrap
studies, parameters, reference_ranges
patients, work_orders, work_order_items
branches, referrers, packages, templates
analysis, analysis_parameters (si catálogo moderno)
analysis_reference_ranges (si migración 0006 aplicada)
 (columns extra de analysis si migración 0007: description, indications, sample_type, sample_container, processing_time_hours, general_units)
```

Para inspeccionar parámetros de un estudio:
```bash
psql lab_hematos -c "SELECT s.name, p.name param, p.unit FROM studies s JOIN parameters p ON p.study_id=s.id WHERE s.name='Biometría Hemática' ORDER BY p.position;"
```

Ver rangos de referencia de un parámetro específico:
```bash
psql lab_hematos -c "SELECT p.name, r.sexo, r.edad_min, r.edad_max, r.valor_min, r.valor_max FROM parameters p JOIN reference_ranges r ON r.parameter_id=p.id WHERE p.name='Hemoglobina' ORDER BY r.sexo, r.edad_min;"
```

Si usas el catálogo moderno y migración 0006, para un parámetro moderno:
```bash
psql lab_hematos -c "SELECT ap.name, rr.sex, rr.age_min, rr.age_max, rr.lower, rr.upper FROM analysis_parameters ap JOIN analysis_reference_ranges rr ON rr.parameter_id=ap.id WHERE ap.name='Hemoglobina' ORDER BY rr.sex, rr.age_min;"
```

Verificar columnas nuevas (migración 0007) en `analysis`:
```bash
psql lab_hematos -c "SELECT column_name FROM information_schema.columns WHERE table_name='analysis' AND column_name IN ('description','indications','sample_type','sample_container','processing_time_hours','general_units');"
```

---
## 7. Rehacer un tenant desde cero
Si quieres borrar y recrear:
```bash
dropdb lab_hematos
createdb lab_hematos
node server/scripts/provisionTenant.js --slug=hematos --email=admin@hematos.com --password='OtraClave123!'
```

Si la DB existe pero faltan tablas (seed o migraciones fallaron la primera vez):
```bash
psql lab_hematos -f server/scripts/migrations/0001_core_schema.sql
psql lab_hematos -f server/scripts/migrations/0002_domain_core.sql
node server/scripts/seedDefaultStudies.js --db=lab_hematos
```

### 7.1 Actualizar un tenant antiguo (que sólo tenía tablas de estudios)
Si aprovisionaste antes de la migración 0002 y ahora quieres todas las tablas:
```bash
psql lab_mi_tenant -f server/scripts/migrations/0002_domain_core.sql
# (reseed opcional — sólo crea estudios faltantes)
node server/scripts/seedDefaultStudies.js --db=lab_mi_tenant
```
Esto añadirá pacientes, órdenes, paquetes, etc. sin borrar datos existentes.

---
## 8. Errores comunes
| Mensaje | Causa | Solución |
|---------|-------|----------|
| `Cannot find module ... server/scripts/server/scripts/...` | Ruta duplicada | Usar `node provisionTenant.js` dentro de la carpeta o ruta completa desde raíz |
| `relation "studies" does not exist` | Seed antes de migraciones | Asegurar migraciones (ya automatizado en versión actual) |
| `permission denied to create database` | Rol PG sin CREATEDB | Crear DB manualmente o usar usuario con privilegios |
| `duplicate key value violates unique constraint on studies.name` | Seed repetido | Es normal si ya existía; el script omite duplicados |

---
## 9. Personalizar el seed
Editar `server/scripts/seedDefaultStudies.js`:
- Añadir o quitar paneles en el arreglo `PANELS`.
- Ejecutar de nuevo el seed sólo afectará estudios inexistentes (no actualiza los ya creados).

Para forzar actualización, elimina el estudio manualmente:
```bash
psql lab_hematos -c "DELETE FROM studies WHERE name='Perfil Cardíaco';"
node server/scripts/seedDefaultStudies.js --db=lab_hematos
```

---
## 10. Seguridad y siguientes pasos
- Cambiar la contraseña inicial del admin desde la aplicación.
- Configurar claves de integraciones (OpenAI, etc.).
- Revisar logs iniciales para confirmar que no hubo warnings críticos.

---
## 11. Resumen rápido (TL;DR)
```bash
# Crear tenant
node server/scripts/provisionTenant.js --slug=demo --email=admin@demo.com --password='Clave123!'
# Verificar
psql lab_demo -c "SELECT COUNT(*) FROM studies;"
psql lab_demo -c "\dt"   # Confirmar tablas de dominio
# Re-seed (si fuese necesario)
node server/scripts/seedDefaultStudies.js --db=lab_demo
```

Listo: el nuevo laboratorio queda operativo con estudios base y rangos de referencia.

---
## 12. Primeros pasos prácticos (API)
Suponiendo que ya iniciaste la API local y obtuviste un token JWT para el admin del tenant.

Crear un paciente (POST /api/patients):
```bash
curl -X POST http://localhost:3000/api/patients \
   -H "Authorization: Bearer <TOKEN>" \
   -H 'Content-Type: application/json' \
   -d '{"first_name":"Juan","last_name":"Pérez","date_of_birth":"1985-04-10","sex":"M"}'
```

Listar pacientes recientes:
```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/patients
```

Obtener folio siguiente de orden (GET /api/work-orders/next-folio):
```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/work-orders/next-folio
```

Crear orden de trabajo mínima (POST /api/work-orders):
```bash
curl -X POST http://localhost:3000/api/work-orders \
   -H "Authorization: Bearer <TOKEN>" \
   -H 'Content-Type: application/json' \
   -d '{"patient_id":"<PATIENT_UUID>","notes":"Toma ayunas"}'
```

Agregar ítem (si existe catálogo "analysis") (POST /api/work-orders/:id/items):
```bash
curl -X POST http://localhost:3000/api/work-orders/<ORDER_ID>/items \
   -H "Authorization: Bearer <TOKEN>" \
   -H 'Content-Type: application/json' \
   -d '{"analysis_id":"<ANALYSIS_UUID>"}'
```

Publicar resultados (ejemplo conceptual):
```bash
# PATCH orden a published (si endpoint disponible)
curl -X PATCH http://localhost:3000/api/work-orders/<ORDER_ID> \
   -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
   -d '{"status":"published"}'
```

---
## 13. Ejemplos SQL directos (opcional)
Insertar un paciente directo en SQL:
```sql
INSERT INTO patients(first_name,last_name,date_of_birth,sex) VALUES('Ana','López','1992-11-05','F') RETURNING id;
```

Crear una orden asociada:
```sql
INSERT INTO work_orders(patient_id, priority, notes) VALUES('<PATIENT_UUID>', 'normal', 'Ayuno 8h') RETURNING id;
```

Agregar un item (si ya existe registro en analysis):
```sql
INSERT INTO work_order_items(work_order_id, analysis_id) VALUES('<ORDER_UUID>','<ANALYSIS_UUID>');
```

Listar órdenes con paciente:
```sql
SELECT wo.id, wo.status, p.full_name
FROM work_orders wo JOIN patients p ON p.id = wo.patient_id
ORDER BY wo.created_at DESC LIMIT 20;
```

---
## 14. Detección de tablas faltantes / upgrade rápido
Para validar si un tenant viejo necesita la migración 0002:
```bash
psql lab_viejo -c "SELECT to_regclass('public.patients') AS patients, to_regclass('public.work_orders') AS work_orders;"
```
Si devuelve `NULL`, aplicar:
```bash
psql lab_viejo -f server/scripts/migrations/0002_domain_core.sql
```

---
## 15. Limpieza y reprocesos
Eliminar completamente un tenant (datos se pierden):
```bash
dropdb lab_demo
psql lab_master -c "DELETE FROM tenants WHERE slug='demo';"
```
Re-crear después con el script de provisión.

---
## 16. Checklist rápida de salud post-provisión
```bash
psql lab_nuevo -c "SELECT count(*) FROM studies;"              # >= 10
psql lab_nuevo -c "SELECT count(*) FROM parameters;"           # > 0
psql lab_nuevo -c "SELECT to_regclass('public.patients');"     # not null
psql lab_nuevo -c "SELECT to_regclass('public.work_orders');"  # not null
psql lab_nuevo -c "SELECT to_regclass('public.packages');"     # not null
```
Si algo falta, aplicar nuevamente la migración correspondiente.

---
## 17. Próximos pasos sugeridos
1. Configurar plantillas (`templates`) para reportes propios.
2. Cargar catálogo extendido de análisis si se usa módulo `analysis` (script dedicado futuro).
3. Implementar backups automáticos (pg_dump + cron). 
4. Habilitar monitoreo (Prometheus/Grafana) y alertas básicas.
5. Revisar políticas de acceso si se añade autenticación multi-rol.

