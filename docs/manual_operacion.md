# Manual de Operación – Aplicación de Laboratorio

Este documento describe el uso operativo de la aplicación web, sus módulos, flujos clave, y el procedimiento de despliegue en producción.

## Índice
- [Introducción](#introducción)
- [Requisitos](#requisitos)
- [Acceso y autenticación](#acceso-y-autenticación)
- [Estructura general de la app](#estructura-general-de-la-app)
- [Módulos funcionales](#módulos-funcionales)
  - [Estudios (Catálogo)](#estudios-catálogo)
  - [Parámetros de estudio](#parámetros-de-estudio)
  - [Órdenes de trabajo](#órdenes-de-trabajo)
  - [Pacientes](#pacientes)
  - [Referenciadores](#referenciadores)
  - [Paquetes](#paquetes)
  - [Finanzas](#finanzas)
  - [Administración](#administración)
- [Flujos operativos clave](#flujos-operativos-clave)
  - [Registro/edición de estudios](#registroedición-de-estudios)
  - [Registro/edición y reordenamiento de parámetros](#registroedición-y-reordenamiento-de-parámetros)
  - [Captura de resultados y validación](#captura-de-resultados-y-validación)
  - [Generación y vista previa de reportes](#generación-y-vista-previa-de-reportes)
  - [Histórico clínico y gráficas](#histórico-clínico-y-gráficas)
- [Despliegue y operaciones](#despliegue-y-operaciones)
  - [Variables de entorno](#variables-de-entorno)
  - [Entorno de desarrollo](#entorno-de-desarrollo)
  - [Build de producción](#build-de-producción)
  - [Ejecución con PM2](#ejecución-con-pm2)
  - [Nginx como proxy reverso](#nginx-como-proxy-reverso)
  - [Mantenimiento](#mantenimiento)
- [Resolución de problemas (Troubleshooting)](#resolución-de-problemas-troubleshooting)
- [Seguridad y buenas prácticas](#seguridad-y-buenas-prácticas)

---

## Introducción
La aplicación permite gestionar el ciclo operativo de un laboratorio: catálogo de estudios y parámetros, órdenes de trabajo, captura de resultados, reportes, pacientes, referenciadores, finanzas y administración.

Backend de datos: Supabase (PostgreSQL + Auth + API). Frontend: React + Vite. Estilos: Tailwind y componentes UI.

## Requisitos
- Navegador moderno (Chrome/Edge/Firefox).
- Acceso a internet para conexión con Supabase.
- Cuenta y proyecto en Supabase con tablas migradas.

## Acceso y autenticación
- Acceda a la URL del sitio. Ingrese con email/contraseña registrados.
- La app usa sesión de Supabase. Cierre de sesión desde el menú de usuario.
- Roles/permisos se administran en el módulo de Administración según su instalación.

## Estructura general de la app
- Barra lateral con navegación por módulos.
- Encabezado con búsqueda y acciones rápidas.
- Contenidos por módulo con tablas, formularios y modales.

## Módulos funcionales

### Estudios (Catálogo)
- Crear/editar/eliminar estudios (nombre, clave, categoría, precio, descripción, indicaciones, datos de muestra y tiempo de proceso).
- Gestión de parámetros por estudio (ver siguiente sección).

### Parámetros de estudio
- Añada parámetros a cada estudio; defina nombre, unidades, decimales, grupo.
- Defina valores de referencia (por sexo, unidades de edad, rangos normales o texto libre).
- Reordenamiento: organice el orden lógico de lectura para el médico (flechas arriba/abajo).

### Órdenes de trabajo
- Crear órdenes con selección de estudios/paquetes, referenciador y datos del paciente.
- Captura de resultados por parámetro; validación y cambio de estado.
- Vista previa y generación de reporte final.

### Pacientes
- Administración de pacientes.
- Histórico de resultados por estudio/parámetro y visualización gráfica (línea de tiempo).

### Referenciadores
- Gestión de entidades que envían o reciben estudios (médicos/instituciones). 
- Asignación de listas de precio por referenciador.

### Paquetes
- Agrupación de estudios en paquetes comerciales.

### Finanzas
- Cuentas por cobrar, facturación/ingresos y reportes.

### Administración
- Usuarios, roles y permisos.
- Auditoría del sistema.
- Preferencias y configuraciones generales.

## Flujos operativos clave

### Registro/edición de estudios
1. Ir a: Módulo Estudios → “Nuevo Estudio” o editar uno existente.
2. Llenar nombre, categoría, clave (se genera si se deja en blanco), precio y demás campos.
3. Guardar. El estudio queda disponible para órdenes.

### Registro/edición y reordenamiento de parámetros
1. En el formulario de estudio, sección “Parámetros a reportar”.
2. “Añadir Parámetro”: capture nombre, unidades, decimales, grupo.
3. Valores de referencia: añada uno o varios registros por sexo/edad; soporta rango numérico o texto.
4. Guardar parámetro.
5. Reordenamiento: use las flechas “subir/bajar” por fila. El orden se persiste por estudio.
   - La columna interna `position` ordena los parámetros (0, 1, 2, …).

Notas:
- Nombres de parámetros únicos por estudio (validación en UI).
- Los cambios se reflejan en captura de resultados y reportes.

### Captura de resultados y validación
1. Abra la orden y seleccione “Capturar/Validar resultados”.
2. Ingrese resultados por parámetro (numéricos o texto según el parámetro).
3. Valide resultados para cambiar estado y generar previsualización del reporte.
4. Guarde y cierre.

### Generación y vista previa de reportes
- Desde la orden validada, abra la previsualización de reporte (PDF/impresión).
- El reporte incluye paciente, estudios, parámetros, resultados y referencias.

### Histórico clínico y gráficas
- En Pacientes → Historial, filtre por estudio/parámetro.
- Visualice tendencias con la gráfica (línea de tiempo) cuando existan múltiples resultados numéricos.

## Despliegue y operaciones

### Variables de entorno
Configure el acceso a Supabase mediante variables (recomendado) o archivo de configuración:
- SUPABASE_URL
- SUPABASE_ANON_KEY

Nota: No exponga llaves “service role” en el cliente.

### Entorno de desarrollo
- Instalar dependencias: `npm install`
- Ejecutar en dev: `npm run dev`

### Build de producción
- Compilar: `npm run build`
- Artifacts en `dist/`.

### Ejecución con PM2
Ejemplo con `vite preview` detrás de Nginx:

- Iniciar en 127.0.0.1:3005
  - `pm2 start "npm run preview -- --host 127.0.0.1 --port 3005" --name labsupabase-prod`
- Ver estado: `pm2 status`
- Logs: `pm2 logs labsupabase-prod`
- Persistir al reinicio: `pm2 save` y `pm2 startup` (seguir instrucciones)

### Nginx como proxy reverso
Ejemplo de servidor (HTTPS) apuntando al preview en 3005:

```
# HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name laboratorioguadalupe.com.mx www.laboratorioguadalupe.com.mx;
    location / { return 301 https://$host$request_uri; }
}

# HTTPS → localhost:3005
server {
    listen 443 ssl;
    listen [::]:443;
    server_name laboratorioguadalupe.com.mx www.laboratorioguadalupe.com.mx;

    ssl_certificate /etc/letsencrypt/live/laboratorioguadalupe.com.mx/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/laboratorioguadalupe.com.mx/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Verificar y recargar:
- `sudo nginx -t`
- `sudo systemctl reload nginx`

## Mantenimiento
- Actualizar dependencias periódicamente.
- Revisar logs de PM2 y Nginx.
- Respaldos de base de datos desde Supabase (políticas y schedules recomendados).
- Monitoreo de disponibilidad y certificados SSL (Let’s Encrypt renovación automática).

## Resolución de problemas (Troubleshooting)
- 502 Bad Gateway (Nginx):
  - Verificar que la app escucha en el puerto esperado. `ss -tuln | grep 3005`
  - Revisar logs: `pm2 logs labsupabase-prod` y `journalctl -u nginx`.
  - Confirmar `proxy_pass` apunta a `127.0.0.1:3005`.
- `ssl_stapling` ignorado: el certificado no expone OCSP. Es un warning, no bloquea. 
- Orden de parámetros no se guarda:
  - Confirmar que el estudio y los parámetros tienen `id`.
  - La app persiste `{ id, analysis_id, name, position }` en `analysis_parameters`.
  - Revisar permisos de RLS en Supabase y constraints.
- Errores de Supabase 400/23502:
  - Falta de campos NOT NULL (p.ej., `analysis_id` o `name`). Asegure el payload correcto.

## Seguridad y buenas prácticas
- Mantenga las llaves en variables de entorno. Evite exponer llaves sensibles.
- Use HTTPS siempre. Redireccione HTTP → HTTPS.
- Limite roles/permiso por usuario desde Administración.
- Aplique actualizaciones de seguridad del sistema y Nginx.

---

Documento mantenido en `docs/manual_operacion.md`. Actualícelo al introducir cambios de funcionalidad.
