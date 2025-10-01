#!/usr/bin/env bash
set -euo pipefail

# ==============================================
# Deploy Script LabG40 (single host)
# Características nuevas:
#  - Modo help
#  - Migraciones backend opcionales
#  - Build frontend
#  - Health check post-restart
#  - Certbot (emisión inicial / dry-run renovación) opcional
#  - Validaciones y logs con timestamps
# Variables opcionales:
#   ENABLE_CERTBOT=1         Gestiona certificados
#   SETUP=1                  Instala/verifica service systemd y nginx antes del build
#   FORCE=1                  Fuerza copia aunque existan archivos destino
#   SKIP_BUILD=1             En modo setup: omitir build
#   CERTBOT_EMAIL=correo     Requerido si emite certificados
#   DOMAIN=labg40.com        Dominio principal
#   BRANCH=main              Rama a desplegar
#   HEALTH_URL=http://127.0.0.1:4100/api/health
#   TIMEOUT_HEALTH=15        (segundos)
# ==============================================

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] [deploy] $*"; }
fail() { echo "[$(ts)] [deploy][ERROR] $*" >&2; exit 1; }

usage(){ cat <<EOF
Uso: $(basename "$0") [BRANCH]
Variables:
  ENABLE_CERTBOT=1         Emite/renueva certificados (requiere CERTBOT_EMAIL, DOMAIN)
  SETUP=1                  Ejecuta instalación/verificación de systemd + nginx
  FORCE=1                  Fuerza sobreescritura de archivos destino
  SKIP_BUILD=1             (con SETUP) omite build
  CERTBOT_EMAIL=mail       Email para Let's Encrypt
  DOMAIN=labg40.com        Dominio principal
  BRANCH=main              Rama si no se pasa como arg
  HEALTH_URL=...           URL health (default http://127.0.0.1:4100/api/health)
  TIMEOUT_HEALTH=15        Segundos espera health
Ejemplo:
  ENABLE_CERTBOT=1 CERTBOT_EMAIL=admin@labg40.com DOMAIN=labg40.com ./deploy.sh
  SETUP=1 FORCE=1 ./deploy.sh
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage; exit 0;
fi

# Directorio del repositorio y carpeta final de build frontend
# Ajustado desde /opt/labg40 a la ruta local solicitada
APP_DIR=${APP_DIR:-/home/gaibarra/labg40}
FRONTEND_DIST=${FRONTEND_DIST:-/home/gaibarra/labg40/dist}
BRANCH=${1:-${BRANCH:-main}}
MODE_SETUP=${SETUP:-0}
DOMAIN=${DOMAIN:-labg40.com}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:4100/api/health}
TIMEOUT_HEALTH=${TIMEOUT_HEALTH:-15}

log "Iniciando despliegue LabG40 (frontend-only, sin git, branch=$BRANCH)"
if [ "$MODE_SETUP" = "1" ]; then
  log "Modo SETUP activo"
fi

# Entrar al directorio de la aplicación (el repo ya está actualizado externamente)
if [ ! -d "$APP_DIR" ]; then
  fail "No existe directorio $APP_DIR"
fi
cd "$APP_DIR"

if [ "$MODE_SETUP" = "1" ]; then
  # Funciones auxiliares para setup
  copy_if_needed(){
    local src=$1 dst=$2 desc=$3
    if [ ! -f "$src" ]; then
      fail "Archivo origen no encontrado: $src ($desc)"; fi
    if [ -f "$dst" ]; then
      if [ "${FORCE:-0}" = "1" ]; then
        log "FORCE=1 reemplazando $desc ($dst)"
      else
        if cmp -s "$src" "$dst"; then
          log "$desc sin cambios ($dst)"
          return 0
        else
          log "$desc existente difiere (use FORCE=1 para reemplazar)"
          return 0
        fi
      fi
    else
      log "Instalando $desc en $dst"
    fi
    sudo install -m 0644 "$src" "$dst"
  }

  log "Setup: systemd service"
  copy_if_needed "$APP_DIR/deploy/labg40-api.service" /etc/systemd/system/labg40-api.service "systemd service"
  if systemctl list-unit-files | grep -q '^labg40-api.service'; then
    log "Service registrado"
  fi
  sudo systemctl daemon-reload
  sudo systemctl enable labg40-api.service >/dev/null 2>&1 || true
  if ! systemctl is-active --quiet labg40-api; then
    log "Arrancando servicio labg40-api"
    sudo systemctl start labg40-api || log "No se pudo iniciar labg40-api (continuando)"
  else
    log "labg40-api ya activo"
  fi

  log "Setup: nginx config"
  copy_if_needed "$APP_DIR/deploy/nginx-labg40.conf" /etc/nginx/sites-available/labg40.conf "nginx config"
  if [ ! -L /etc/nginx/sites-enabled/labg40.conf ]; then
    if [ -e /etc/nginx/sites-enabled/labg40.conf ]; then
      log "Advertencia: existe archivo no symlink en sites-enabled/labg40.conf"
    else
      sudo ln -s /etc/nginx/sites-available/labg40.conf /etc/nginx/sites-enabled/labg40.conf
      log "Creado symlink sites-enabled"
    fi
  else
    log "Symlink nginx ya presente"
  fi
  if sudo nginx -t; then
    sudo systemctl reload nginx
    log "Nginx recargado tras setup"
  else
    log "Error validando nginx - no recargado"
  fi

  if [ "${SKIP_BUILD:-0}" = "1" ]; then
    log "SKIP_BUILD=1 => omitiendo build y pasos restantes"
    log "Resumen final setup:" 
    log "  Setup:         OK (parcial si hubo advertencias)"
    log "  Force:         ${FORCE:-0}" 
    log "  Repo dir:      $APP_DIR"
    log "  Dist dir:      $FRONTEND_DIST"
    log "Listo (setup)"
    exit 0
  fi
fi

log "Instalando dependencias (incluye dev necesarias para build)"
npm ci

log "Build frontend (Vite)"
npm run build

log "Permisos dist (${FRONTEND_DIST}) (www-data)"
if [ -d "${FRONTEND_DIST}" ]; then
  chown -R www-data:www-data "${FRONTEND_DIST}" || log "Advertencia: no se pudo cambiar propietario ${FRONTEND_DIST} (ignorado)"
  # Garantizar que www-data puede 'traversar' directorios padres cuando APP_DIR está en /home/<user>
  if ! sudo -u www-data test -r "${FRONTEND_DIST}/index.html" 2>/dev/null; then
    parent_home="/home/$(basename $(dirname $(dirname ${FRONTEND_DIST})))"
    log "www-data no puede leer index.html aún; ajustando ACL de acceso en rutas padres y dist"
    if command -v setfacl >/dev/null 2>&1; then
      setfacl -m u:www-data:rx "${parent_home}" 2>/dev/null || true
      setfacl -m u:www-data:rx "${APP_DIR}" 2>/dev/null || true
      setfacl -R -m u:www-data:rx "${FRONTEND_DIST}" 2>/dev/null || true
    else
      log "setfacl no disponible; aplicando chmod de ejecución en rutas padres (menos restrictivo)"
      chmod o+X "${parent_home}" 2>/dev/null || true
      chmod o+X "${APP_DIR}" 2>/dev/null || true
    fi
    if sudo -u www-data test -r "${FRONTEND_DIST}/index.html" 2>/dev/null; then
      log "Acceso a dist confirmado para www-data"
    else
      log "Persisten problemas de acceso a dist para www-data (revisar manualmente permisos)"
    fi
  fi
else
  log "Advertencia: no existe ${FRONTEND_DIST} tras el build"
fi

log "(omitido) Reinicio backend (ya operativo)"
ok_health="NA"

log "Verificando configuración Nginx"
sudo nginx -t
log "Recargando Nginx"
sudo systemctl reload nginx

# Certbot (opcional)
if [ "${ENABLE_CERTBOT:-0}" = "1" ]; then
  if ! command -v certbot >/dev/null 2>&1; then
    log "Certbot no instalado (omitiendo)"; else
    if [ -z "${CERTBOT_EMAIL:-}" ]; then
      log "CERTBOT_EMAIL no definido; omitiendo emisión"
    else
      if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
        log "Emitiendo certificados iniciales para ${DOMAIN}"
        sudo certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --agree-tos -m "${CERTBOT_EMAIL}" --redirect --non-interactive || log "Fallo emisión certbot"
      else
        log "Renovación (dry-run)"
        sudo certbot renew --dry-run || log "Dry-run renovación falló"
      fi
    fi
  fi
else
  log "Certbot desactivado (ENABLE_CERTBOT!=1)"
fi

log "Resumen final:" 
log "  Branch:        $BRANCH"
log "  Migraciones:   (omitidas)" 
log "  Certbot:       ${ENABLE_CERTBOT:-0}" 
log "  Health URL:    $HEALTH_URL (estado: ${ok_health})"
log "  Dominio:       $DOMAIN"
log "  Repo dir:      $APP_DIR"
log "  Dist dir:      $FRONTEND_DIST"

log "Listo"
