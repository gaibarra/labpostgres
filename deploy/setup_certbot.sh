#!/usr/bin/env bash
set -euo pipefail

# Script: setup_certbot.sh
# Objetivo: (Re)instalar certbot + plugin nginx, emitir certificado para labg40.com y www.labg40.com
# y asegurar bloque HTTPS en la configuración de Nginx.
#
# Variables opcionales:
#   DOMAIN=labg40.com
#   EMAIL=admin@labg40.com   (OBLIGATORIO para emisión real)
#   DRY_RUN=1                (Solo prueba --dry-run)
#   FORCE_REISSUE=1          (Fuerza reintento aunque exista directorio live)
#   APT=1                    (Forzar uso de apt aunque snap esté disponible)
#   SNAP=1                   (Forzar migración a snap)
#
# Uso ejemplos:
#   EMAIL=admin@labg40.com ./deploy/setup_certbot.sh
#   DRY_RUN=1 EMAIL=admin@labg40.com ./deploy/setup_certbot.sh
#   FORCE_REISSUE=1 EMAIL=admin@labg40.com ./deploy/setup_certbot.sh

ts(){ date '+%Y-%m-%d %H:%M:%S'; }
log(){ echo "[$(ts)] [certbot] $*"; }
fail(){ echo "[$(ts)] [certbot][ERROR] $*" >&2; exit 1; }

DOMAIN=${DOMAIN:-labg40.com}
EMAIL=${EMAIL:-}
DRY_RUN=${DRY_RUN:-0}
FORCE_REISSUE=${FORCE_REISSUE:-0}
FORCE_APT=${APT:-0}
FORCE_SNAP=${SNAP:-0}

if [ $FORCE_APT -eq 1 ] && [ $FORCE_SNAP -eq 1 ]; then
  fail "No puede usar APT=1 y SNAP=1 a la vez"
fi

if [ -z "$EMAIL" ]; then
  log "EMAIL no definido (solo se realizará instalación, no emisión). Use EMAIL=tu@correo"; EMAIL_MISSING=1; else EMAIL_MISSING=0; fi

log "Dominio objetivo: $DOMAIN (www.$DOMAIN)"

if [ $(id -u) -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    log "Reejecutando con sudo"
    exec sudo DOMAIN="$DOMAIN" EMAIL="$EMAIL" DRY_RUN="$DRY_RUN" FORCE_REISSUE="$FORCE_REISSUE" APT="$FORCE_APT" SNAP="$FORCE_SNAP" bash "$0"
  else
    fail "Ejecutar como root o con sudo"
  fi
fi

source /etc/os-release || fail "No se pudo leer /etc/os-release"
log "Sistema: $NAME $VERSION_ID"

install_via_apt(){
  log "Instalando Certbot vía apt"
  apt-get update -y
  apt-get install -y certbot python3-certbot-nginx || fail "Fallo instalando certbot apt"
}

install_via_snap(){
  log "Instalando Certbot vía snap"
  if ! command -v snap >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y snapd || fail "Fallo instalando snapd"
  fi
  snap install core || true
  snap refresh core || true
  snap install --classic certbot || fail "Fallo instalando certbot snap"
  ln -sf /snap/bin/certbot /usr/bin/certbot
}

# Decidir método instalación
if [ $FORCE_APT -eq 1 ]; then
  install_via_apt
elif [ $FORCE_SNAP -eq 1 ]; then
  install_via_snap
else
  if command -v certbot >/dev/null 2>&1; then
    log "Certbot ya instalado ($(certbot --version 2>/dev/null || echo desconocido))"
  else
    # Preferencia snap (recomendación oficial) si snap disponible
    if command -v snap >/dev/null 2>&1; then install_via_snap; else install_via_apt; fi
  fi
fi

log "Versión Certbot: $(certbot --version 2>/dev/null || echo '?')"

LIVE_DIR="/etc/letsencrypt/live/$DOMAIN"
if [ -d "$LIVE_DIR" ] && [ $FORCE_REISSUE -ne 1 ]; then
  log "Certificado ya existe en $LIVE_DIR (use FORCE_REISSUE=1 para reemitir)"
  CERT_EXISTS=1
else
  CERT_EXISTS=0
fi

if [ $EMAIL_MISSING -eq 1 ]; then
  log "Saliendo (no se intentará emisión sin EMAIL)"
  exit 0
fi

if [ $DRY_RUN -eq 1 ]; then
  # En dry-run debemos usar 'certonly' (run no soporta --dry-run)
  cmd=(certbot certonly --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL" --agree-tos --no-eff-email --rsa-key-size 4096 --dry-run)
else
  cmd=(certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL" --agree-tos --no-eff-email --rsa-key-size 4096 --redirect)
fi
if [ $FORCE_REISSUE -eq 1 ]; then cmd+=(--force-renewal); fi

log "Ejecutando: ${cmd[*]}"
if ! "${cmd[@]}"; then
  fail "Fallo emisión certbot"
fi

if [ $DRY_RUN -eq 1 ]; then
  log "Dry-run completado correctamente. Ejecute nuevamente sin DRY_RUN=1 para emitir real."
  exit 0
fi

if [ ! -d "$LIVE_DIR" ]; then
  fail "No se creó directorio $LIVE_DIR tras emisión"
fi

log "Certificado emitido. Archivos:"
ls -1 "$LIVE_DIR" || true

# Asegurar bloque HTTPS (si certbot no lo añadió)
NGINX_CONF="/etc/nginx/sites-available/labg40.conf"
if grep -q "listen 443" "$NGINX_CONF" 2>/dev/null; then
  log "Bloque 443 ya presente en $NGINX_CONF"
else
  log "Añadiendo bloque 443 a $NGINX_CONF"
  cat >> "$NGINX_CONF" <<BLK

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    root /home/gaibarra/labg40/dist;
    index index.html;
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    # Reutilizar locations básicos
    location ~* \.(?:js|css|woff2|woff|ttf|eot|svg)$ { try_files $uri =404; access_log off; add_header Cache-Control "public, max-age=31536000, immutable"; }
    location ~* \.(?:png|jpg|jpeg|gif|webp|ico)$ { try_files $uri =404; access_log off; add_header Cache-Control "public, max-age=2592000"; }
    location /api/ { proxy_pass http://127.0.0.1:4100/api/; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade; proxy_redirect off; proxy_read_timeout 65s; proxy_send_timeout 65s; }
    location / { try_files $uri /index.html; }
    location ~* \.(env|log|md|sql)$ { deny all; }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://$host$request_uri;
}
BLK
fi

if nginx -t; then
  systemctl reload nginx || log "No se pudo recargar nginx"
  log "Nginx recargado"
else
  fail "Configuración Nginx inválida, revisar"
fi

log "Finalizado"