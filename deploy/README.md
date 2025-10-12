# Despliegue Producción (Single Host: labg40.com)

Arquitectura:
- Nginx sirve frontend estático (build Vite) y actúa como proxy inverso a Node (backend Express) en /api.
- Node (Express) corre sólo en 127.0.0.1:4100 vía systemd.
- Certbot (Let’s Encrypt) gestiona TLS para labg40.com y www.labg40.com.

## Estructura recomendada en servidor
```
/opt/labg40/              # repo clonado (git pull para actualizaciones)
 ├─ dist/                 # build frontend (npm run build)
 ├─ server/               # backend
 ├─ deploy/               # estos artefactos
 └─ .env                  # variables de entorno (copiar desde .env.production.example)
```

## 1. Requisitos
```
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx nodejs npm git
```
Node >= 20 (usar nvm si versión de distro es antigua).

## 2. Variables de Entorno
Copiar `deploy/.env.production.example` a `.env` en raíz y ajustar valores (DB, claves, CORS).

Puntos clave:
- PORT=4100
- CORS_ORIGINS=https://labg40.com,https://www.labg40.com
- SECURE_COOKIES=1 (si usas cookies para auth)

## 3. Build Frontend & Dependencias
```
cd /opt/labg40
npm ci
npm run build
```
El build genera `dist/` con assets versionados.

## 4. Systemd Service
Instalar archivo:
```
sudo cp deploy/labg40-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now labg40-api
sudo systemctl status labg40-api
```

Logs:
```
journalctl -u labg40-api -f
```

## 5. Nginx
Copiar config y habilitar:
```
sudo cp deploy/nginx-labg40.conf /etc/nginx/sites-available/labg40.conf
sudo ln -s /etc/nginx/sites-available/labg40.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Luego certificados:
```
sudo certbot --nginx -d labg40.com -d www.labg40.com --agree-tos -m tu-email@dominio.com --redirect
```
Certbot ajustará server blocks para TLS. Verifica que los headers de seguridad se conserven (si no, re-insertarlos post-certbot).

## 6. Deploy Script (Opcional)
Editar credenciales y ejecutar:
```
sudo bash deploy/deploy.sh
```
Hace: pull, install, build, restart backend.

## 7. Health Checks
- Backend: https://labg40.com/api/health
- Métricas: https://labg40.com/api/metrics (proteger si es necesario)

### Chequeo diario de duplicados en rangos de referencia
Instala servicio y timer para validar diariamente que no existan duplicados en `reference_ranges`/`analysis_reference_ranges`.

Instalación:
```
sudo cp deploy/check-reference-duplicates.service /etc/systemd/system/
sudo cp deploy/check-reference-duplicates.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now check-reference-duplicates.timer
```

Ejecución manual y revisión de logs:
```
sudo systemctl start check-reference-duplicates.service
journalctl -u check-reference-duplicates -n 100 -f
```

Semántica de salida del script:
- Exit 0: sin duplicados. Imprime JSON con conteos.
- Exit 2: se detectaron duplicados (stderr incluye resumen).
- Exit 1: error al ejecutar (con detalle en logs).

## 8. Restaurar / Rollback
Mantener etiqueta git previa a actualización. Para rollback:
```
git checkout <tag_anterior>
npm ci
npm run build
sudo systemctl restart labg40-api
```

## 9. Seguridad Extra
- Activar firewall: permitir 22,80,443.
- Fail2ban para SSH / Nginx.
- Revisar periodicidad de `apt upgrade` y auto-renovación certbot (cron ya se instala por defecto).

## 10. Resumen Flujo de Actualización
```
git pull
npm ci --omit=dev (opcional backend si separamos builds)
npm run build
sudo systemctl restart labg40-api
sudo nginx -t && sudo systemctl reload nginx
```

---
Si necesitas variante multi-host (api subdominio) o Docker Compose, se puede añadir otra carpeta. Pide “docker” y se genera. 
