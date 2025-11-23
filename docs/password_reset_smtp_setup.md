# Guía Paso a Paso: Configurar las Variables SMTP para los Correos de Recuperación de Contraseña

Esta guía está pensada para alguien sin experiencia técnica previa. Sigue cada paso en orden y podrás habilitar el envío de correos de restablecimiento de contraseña en LabG40.

---
## 1. ¿Qué vas a lograr?
Cuando un usuario hace clic en “¿Olvidaste tu contraseña?”, el backend envía un correo con un enlace seguro. Para que ese correo salga correctamente necesitas configurar unas variables de entorno (las famosas "SMTP variables").

---
## 2. Requisitos previos (lo que necesitas juntar primero)
1. **Proveedor de correo:** usaremos **Gmail/Google** con la cuenta `labg40root@gmail.com`.
2. **Credenciales SMTP** específicas para esa cuenta, que normalmente incluyen:
   - Servidor (host)
   - Puerto
   - Si usa cifrado SSL/TLS
   - Usuario (generalmente la dirección de correo)
   - Contraseña o **App Password** (Gmail lo exige para apps externas)
3. **Un remitente claro** (nombre y correo) que verán los usuarios, por ejemplo: `"Laboratorio Clínico" <labg40root@gmail.com>`.
4. **Acceso para editar el archivo `.env`** del backend o para agregar variables en el servicio systemd / contenedor donde corre `labg40-api`.

> 💡 *Para esta guía: entra a https://myaccount.google.com/apppasswords con la cuenta `labg40root@gmail.com`, crea una contraseña de aplicación (elige "Correo" / "Otro"), anótala y úsala en los pasos siguientes.*

---
## 3. Conoce las variables que debes configurar
El backend lee primero las variables específicas de recuperación (`PASSWORD_RESET_SMTP_*`). Si no existen, usa las globales (`SMTP_*`).

| Variable | ¿Para qué sirve? | Ejemplo |
|----------|------------------|---------|
| `APP_BASE_URL` | URL pública donde se carga la UI. Se usa para generar el enlace del correo (`https://app.tulab.com`). | `https://app.laboratorio.com` |
| `PASSWORD_RESET_SMTP_HOST` | Servidor SMTP (si falta, usa `SMTP_HOST`). | `smtp.gmail.com` |
| `PASSWORD_RESET_SMTP_PORT` | Puerto del servidor (por defecto 587). | `587` |
| `PASSWORD_RESET_SMTP_SECURE` | `1` o `true` si usas SSL directo (465). `0` o `false` para STARTTLS (587). | `0` |
| `PASSWORD_RESET_SMTP_USER` | Usuario/correo autenticado (si falta, usa `SMTP_USER`). | `labg40root@gmail.com` |
| `PASSWORD_RESET_SMTP_PASS` | Contraseña/App Password (si falta, usa `SMTP_PASS`). | `abcd-1234-xyz` |
| `PASSWORD_RESET_EMAIL_FROM` | Nombre y correo que verán los pacientes (si falta, usa `SMTP_FROM` o el `USER`). | `"Laboratorio Clínico" <labg40root@gmail.com>` |
| `PASSWORD_RESET_TOKEN_MINUTES` *(opcional)* | Cuánto dura el enlace antes de expirar (por defecto 60). | `90` |

Si NO quieres separar la configuración de los correos de resultados y los de recuperación, basta con definir las variables `SMTP_*`. El backend tomará esos valores automáticamente.

---
## 4. Paso a paso para configurar en `.env`
1. Abre el archivo `.env` que usa `server/index.js` (cada instalación lo puede tener en un lugar distinto; si usas systemd, edita la unidad y agrega `Environment=`).
2. Agrega (o actualiza) la siguiente sección con tus datos reales:
   ```env
   APP_BASE_URL="https://app.laboratorio.com"

   # Valores compartidos (fallback)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=0
   SMTP_USER=labg40root@gmail.com
   SMTP_PASS=<APP_PASSWORD_GMAIL>
   SMTP_FROM="Laboratorio Clínico <labg40root@gmail.com>"

   # Valores dedicados para recuperación (opcional)
   PASSWORD_RESET_SMTP_HOST=smtp.gmail.com
   PASSWORD_RESET_SMTP_PORT=587
   PASSWORD_RESET_SMTP_SECURE=0
   PASSWORD_RESET_SMTP_USER=labg40root@gmail.com
   PASSWORD_RESET_SMTP_PASS=<APP_PASSWORD_GMAIL>
   PASSWORD_RESET_EMAIL_FROM="Laboratorio Clínico <labg40root@gmail.com>"
   PASSWORD_RESET_TOKEN_MINUTES=90
   ```
3. Guarda el archivo.
4. Reinicia el backend para que cargue los nuevos valores:
   - Si usas systemd: `sudo systemctl restart labg40-api.service`
   - Si estás en desarrollo: detén y vuelve a levantar `npm --prefix server run dev`.

---
## 5. Verifica que todo funciona
### 5.1. Prueba rápida desde la UI
1. Ve a `/login` → `¿Olvidaste tu contraseña?`.
2. Introduce un correo válido.
3. Si todo está bien:
   - La pantalla mostrará el mensaje de éxito.
   - En la consola del backend NO debería aparecer la advertencia `SMTP no configurado`.
   - El usuario debería recibir un correo con un enlace `https://.../reset-password?token=...`.

### 5.2. Prueba manual vía API (opcional)
Usa `curl` (cambia el correo por uno propio):
```bash
curl -X POST http://localhost:4100/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com"}'
```
- Respuesta esperada: `{ "success": true }`.
- Si estás en desarrollo o TEST_MODE, también verás `previewToken` y `previewLink` en el JSON para probar sin enviar correo real.

### 5.3. Completa el flujo
1. Abre el enlace recibido (o el `previewLink`).
2. Ingresa la nueva contraseña.
3. Verifica que al iniciar sesión la contraseña anterior ya no funcione y la nueva sí.

---
## 6. Errores comunes y soluciones
| Mensaje / Síntoma | Qué significa | Qué hacer |
|-------------------|---------------|-----------|
| `[AUTH][RESET] SMTP no configurado` | Faltan `PASSWORD_RESET_SMTP_*` y `SMTP_*`. | Revisa `.env` y reinicia el backend. |
| `ECONNECTION` o `ETIMEDOUT` | Host/puerto incorrectos o firewall bloqueado. | Verifica datos del proveedor; puertos 587/465 deben estar abiertos. |
| `EAUTH` / `Invalid login` | Usuario o password incorrectos (App Password caducada). | Genera nueva App Password y actualiza `.env`. |
| Correos en spam | Dominio sin SPF/DKIM o `from` no coincide con el dominio autenticado. | Configura SPF/DKIM en tu DNS. |
| El enlace abre `http://localhost:5173` | No definiste `APP_BASE_URL`. | Pon la URL pública real. |
| El enlace dice "Token inválido" | El token expiró o ya se usó. | Solicita uno nuevo; ajusta `PASSWORD_RESET_TOKEN_MINUTES` si necesitas más tiempo. |

---
## 7. Checklist final
- [ ] Tengo `APP_BASE_URL` apuntando al dominio real.
- [ ] Definí `SMTP_*` **o** `PASSWORD_RESET_SMTP_*` con credenciales válidas.
- [ ] Reinicié el backend.
- [ ] Probé el flujo "Olvidé mi contraseña" y recibí el correo.
- [ ] El enlace me llevó a la pantalla de restablecer y pude cambiar la contraseña.
- [ ] Documenté dónde guardé la App Password y cuándo debo rotarla.

---
## 8. Consejos para operación continua
- Revisa una vez al mes que los correos lleguen (pide a alguien externo que pruebe).
- Programa un recordatorio para rotar la App Password cada 6–12 meses.
- Si cambias de dominio o URL, actualiza `APP_BASE_URL` inmediatamente.
- No compartas la contraseña SMTP en chats; usa un gestor de secretos.

¡Listo! Con estas variables configuradas, el módulo de recuperación de contraseña quedará funcionando y seguro.
