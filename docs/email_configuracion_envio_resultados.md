# Guía Paso a Paso: Configuración Completa de Email para Envío de Resultados

Esta guía explica cómo preparar y mantener la configuración de correo electrónico usada para enviar Reportes de Resultados (PDF) a Pacientes y Entidades Referentes, considerando entorno multi-tenant, seguridad, rotación y verificación.

---
## 1. Objetivos
- Permitir envío automático de reportes vía endpoint backend (`POST /work-orders/:id/send-report/email`).
- Aislar configuración SMTP por tenant cuando se requiere distinta identidad (From).
- Ofrecer fallback global mediante variables de entorno (`SMTP_*`).
- Facilitar rotación segura de credenciales sin interrumpir el servicio.
- Asegurar trazabilidad y manejo de errores claros.

---
## 2. Arquitectura Resumida
1. Frontend (Administración → Configuración → Integraciones) guarda datos SMTP en `lab_configuration.integrations_settings.smtp`.
2. Backend endpoint `/work-orders/:id/send-report/email` resuelve prioridad:
   1. Payload `smtp` enviado explícitamente.
   2. Configuración del tenant (`integrations_settings.smtp`).
   3. Variables de entorno (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_REPLY_TO`).
   4. Defaults (host `smtp.gmail.com`, port `587`, secure `false`).
3. Servicio `sendReportEmail` genera PDF resumido y envía correo con `nodemailer`.
4. Destinatario se deriva del body `to` o, si falta, del email del paciente (`patients.email`).

---
## 3. Campos y Fuentes de Configuración
| Campo | Fuente UI (tenant) | ENV Global | Ejemplo | Notas |
|-------|--------------------|------------|---------|-------|
| host  | smtp.host          | SMTP_HOST  | smtp.gmail.com | Servidor SMTP. |
| port  | smtp.port          | SMTP_PORT  | 587 | 465 para SSL implícito. |
| secure| smtp.secure        | SMTP_SECURE| false | `true` para SSL directo; `false` para STARTTLS. |
| user  | smtp.user          | SMTP_USER  | no-reply@lab.com | Credencial/autenticación. |
| pass  | smtp.pass          | SMTP_PASS  | app-password | Usar App Password / token, no password personal. |
| from  | smtp.from          | SMTP_FROM  | "Laboratorio X <no-reply@lab.com>" | Si no se define, cae en `user`. |
| replyTo | smtp.replyTo     | SMTP_REPLY_TO | soporte@lab.com | Opcional para respuestas. |

Campos API (alternativos para proveedores transaccionales): `emailServiceProvider`, `emailApiUser`, `emailApiKey` (no usados por el endpoint SMTP actual, reservados para futura integración SendGrid/Mailgun).

### 3.1 Explicación sencilla (para usuarios no técnicos)
Piensa en el envío de email como mandar una carta:
- El "host" y el "port" son la dirección y la puerta de la oficina de correos.
- El "user" y el "pass" son tu credencial para entrar a esa oficina.
- El "from" es el remitente que aparece en la carta.
- El "replyTo" es la dirección donde quieres recibir las respuestas.

#### host
"Host" es el nombre del servidor que envía los correos. Cada proveedor (Gmail, Outlook, SendGrid, etc.) tiene uno. Ejemplos:
- Gmail: `smtp.gmail.com`
- Outlook/Office 365: `smtp.office365.com`
- SendGrid: `smtp.sendgrid.net`
Si no sabes cuál usar, revisa la documentación de tu proveedor de correo o pregunta al área técnica. No inventes un nombre: debe ser exacto.

#### port
El "port" (puerto) es el número de la puerta por la que se conecta el programa. Los más comunes:
- `587`: conexión segura usando STARTTLS (recomendado en la mayoría de casos modernos).
- `465`: conexión segura directa (SSL implícito) usada por algunos servicios legacy.
Si dudas, prueba primero 587. No uses números como 80 o 443 (son para web, no para correo).

#### secure
Indica si la conexión es "segura" desde el inicio.
- `false` (o vacío): el sistema inicia normal y luego activa cifrado (STARTTLS). Es el modo típico con puerto 587.
- `true`: el cifrado comienza desde el primer segundo (usado usualmente con puerto 465).
Si pones `secure=true` pero usas puerto 587, algunos servidores rechazarán la conexión.

#### user
Es la cuenta de correo o identificador que autoriza el envío. Normalmente es una dirección tipo `no-reply@midominio.com`.
Recomendaciones:
- Usa una cuenta dedicada (ej. `no-reply@...`) para que tu bandeja personal no se mezcle.
- No cambies esta cuenta sin coordinar: afecta a SPF/DKIM y podría causar que tus correos vayan a spam.

#### pass
Es la contraseña especial para enviar correos (App Password o token). No debe ser tu contraseña personal.
Por ejemplo, Gmail permite crear "App Password" si tienes verificación en dos pasos. Si la App Password se borra, los envíos fallarán.
Nunca compartas este valor por chat abierto. Guárdalo en un gestor seguro. Si sospechas filtración, genera uno nuevo y borra el antiguo.

#### from
Es lo que ven los pacientes como remitente. Formato recomendado: `Nombre del Laboratorio <correo@dominio>`.
Ejemplos:
- `Laboratorio Central <no-reply@labcentral.com>`
- `Lab Diagnóstico Norte <resultados@labnorte.com>`
Debe usar un dominio que tengas configurado con tus registros SPF / DKIM para que no acabe en spam. Si lo dejas vacío, el sistema usa el mismo valor de `user`.

#### replyTo (opcional)
Si el paciente responde al correo de resultados, ¿a dónde llega esa respuesta? Puedes poner un buzón distinto, por ejemplo `atencion@midominio.com`.
Si lo dejas vacío, las respuestas irán a la cuenta `from`/`user`. Útil para separar correos automáticos (no-reply) de los que sí atiendes.

### 3.2 Prioridad de fuentes (¿de dónde toma el sistema cada dato?)
Orden de elección para cada campo:
1. Lo que envías puntualmente en el body `smtp` del endpoint (override temporal).
2. Lo guardado en la Configuración del tenant (pantalla Integraciones).
3. Las variables del servidor (`SMTP_HOST`, etc.) definidas por el administrador.
4. El valor por defecto (ej. `smtp.gmail.com`, puerto 587, secure=false).

Ejemplo práctico:
"Quiero que solo este envío use otra cuenta" → incluyo un objeto `smtp` en el body y no toco la configuración.
"Quiero cambiar el remitente de todos los correos de mi laboratorio" → edito los campos SMTP en Integraciones y guardo.
"Quiero un ajuste global para todos los tenants" → modifico variables en el servidor y reinicio el servicio.

### 3.3 Errores frecuentes y cómo evitarlos
- Host mal escrito (ej. `smtp.gmial.com`): verás fallo de conexión. Copia y pega desde la documentación oficial.
- Puerto incorrecto (ej. 25 sin TLS): algunos proveedores modernos lo bloquean; usa 587 o 465.
- Usar contraseña personal: si activas doble factor luego deja de funcionar; crea App Password específica.
- `from` con un dominio no autenticado: los correos terminan en spam. Asegura SPF/DKIM.
- `replyTo` inexistente: pacientes responden y el correo rebota; valida que la bandeja exista.

### 3.4 Buenas prácticas rápidas
- Mantén un registro interno (fecha, quién cambió, motivo).
- Revisa una vez al mes que los correos lleguen y no caigan en spam.
- Programa rotación del `pass` (App Password) cada 6–12 meses.
- Evita usar cuentas personales (se dificulta la continuidad si alguien deja la organización).

---
## 4. Flujo de Configuración Inicial
1. Definir estrategia: ¿Un único remitente global o uno distinto por tenant?
2. Si es multi-tenant con remitente distinto:
   - Acceder a Administración → Integraciones.
   - Completar formulario SMTP (Host, Puerto, TLS, Usuario, Password, From, Reply-To).
   - Guardar (PATCH /api/config).
3. Si es remitente único global:
   - Omitir campos UI o dejarlos vacíos.
   - Definir variables en `.env` / systemd:
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_SECURE=0
     SMTP_USER=no-reply@laboratorio.com
     SMTP_PASS=app-password-generado
     SMTP_FROM="Laboratorio Clínico <no-reply@laboratorio.com>"
     SMTP_REPLY_TO=contacto@laboratorio.com
     ```
4. Verificar que las credenciales funcionan (ver Sección 9: Pruebas).

---
## 5. Endpoint de Envío
`POST /work-orders/:id/send-report/email`
Body opcional:
```json
{
  "to": "paciente@correo.com",            // opcional si paciente tiene email
  "patient": { "full_name": "Nombre Paciente" }, // opcional, se completa si falta
  "smtp": {                                // opcional, override puntual
    "host": "smtp.office365.com",
    "port": 587,
    "secure": false,
    "user": "no-reply@labA.com",
    "pass": "<app-pass>",
    "from": "Laboratorio A <no-reply@labA.com>",
    "replyTo": "atencion@labA.com"
  },
  "labName": "Laboratorio A"
}
```
Prioridad final de cada campo = primero `smtp` del body, luego configuración tenant, luego ENV, luego default.

### Respuestas y Errores Comunes
| Código | Mensaje | Causa |
|--------|---------|-------|
| 200 OK | `{ ok: true, sendResult: {...} }` | Envío exitoso. |
| SMTP_NOT_CONFIGURED | Faltan `user/pass` | No hay credenciales válidas en ninguna fuente. |
| NO_RESULTS_TO_SEND | Orden sin resultados | Debe existir `work_orders.results`. |
| NO_RECIPIENT | Falta destinatario | Ni `to` ni email en paciente. |
| EMAIL_SEND_FAIL | Error interno nodemailer | Credenciales inválidas / conexión fallida. |

---
## 6. Seguridad y Buenas Prácticas
- Usar App Password (Gmail, Outlook) o token de proveedor; evitar contraseña personal.
- Limitar visibilidad de secretos en UI: **la UI muestra el valor pero podría implementarse masking** (futuro) como con OpenAI.
- Rotar credenciales al menos cada 6 meses.
- Registrar cambios críticos en auditoría (pendiente: ampliar auditoría para SMTP: creación, rotación, eliminación).
- No incluir `pass` en logs. Revisar console para asegurar que no se imprime.

---
## 7. Rotación de Credenciales (Procedimiento)
1. Generar nueva credencial (App Password / token).
2. En horario de baja carga:
   - Abrir Integraciones.
   - Reemplazar `smtp.pass` (y `smtp.user` si cambia).
   - Guardar.
3. Probar envío de un reporte de prueba (ver Sección 9).
4. Eliminar credencial anterior del proveedor.
5. (Opcional) Documentar hash parcial o fecha de rotación en `integrations_meta` (futuro).

Fallback rotación global (ENV):
- Editar `.env` o unidad systemd (`Environment=SMTP_PASS=newpass`).
- Reiniciar servicio `labg40-api.service`.
- Probar envío.

---
## 8. Multi-Tenant: Estrategias
| Escenario | Ventaja | Consideraciones |
|-----------|---------|-----------------|
| Global ENV | Simplicidad | Un único remitente; difícil personalizar branding de correo. |
| Per-tenant SMTP | Identidad propia por laboratorio | Mayor mantenimiento (rotaciones independientes). |
| Mezcla | Personalizar sólo algunos tenants | Asegurar que los demás no definen campos parcialmente (evitar confusión). |

Recomendación: Si hay más de 3 laboratorios con marca distinta → usar per-tenant. Si es piloto inicial → ENV global.

---
## 9. Pruebas de Funcionamiento
### 9.1. Envío de Prueba Manual
1. Seleccionar una orden con resultados.
2. Colocar (o verificar) email del paciente en la ficha.
3. Consumir endpoint (ejemplo con curl):
   ```bash
   curl -X POST \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     http://localhost:4100/api/work-orders/<ORDER_ID>/send-report/email \
     -d '{"labName":"Laboratorio Demo"}'
   ```
4. Revisar respuesta `{ ok: true }` y llegada del correo.

### 9.2. Override Puntual
- Incluir objeto `smtp` en body para forzar envío con credenciales distintas (útil para diagnóstico).

### 9.3. Validación Pre-envío
- Confirmar que `work_orders.results` está completo y validado (status `Reportada` o con datos).

---
## 10. Mejoras Opcionales (Roadmap)
| Mejora | Descripción |
|--------|-------------|
| Auditoría SMTP | Registrar eventos: creado, rotado, borrado. |
| Masking UI | Ocultar `pass` y mostrar sólo último segmento. |
| Health Check SMTP | Endpoint `/smtp/health` para probar conexión sin enviar. |
| DKIM auto-check | Script que valide registros DNS y muestre estado. |
| API Providers | Integrar SendGrid/Mailgun vía `emailApiKey` para métricas y plantillas. |

---
## 11. Entregabilidad (SPF / DKIM / DMARC)
Asegura que tus correos no caigan en spam:
1. SPF: Agrega en DNS (TXT) `v=spf1 include:_spf.google.com ~all` (ajusta según proveedor).
2. DKIM: Para Gmail dominios propios → configurar en Admin Console / proveedor hosting. Para otros (SendGrid) → generar claves y añadir registros CNAME/TXT.
3. DMARC: TXT `_dmarc.tudominio.com` → `v=DMARC1; p=none; rua=mailto:dmarc@tudominio.com` (inicia como `none`, luego `quarantine` / `reject`).
4. Verifica con herramientas como `https://mxtoolbox.com`.

---
## 12. Troubleshooting
| Síntoma | Acción |
|---------|--------|
| `SMTP_NOT_CONFIGURED` | Revisar UI y ENV: faltan user/pass. |
| `EMAIL_SEND_FAIL` | Probar credenciales con cliente SMTP externo. Confirmar puerto y TLS. |
| Retraso en entrega | Comprobar cola de proveedor / logs nodemailer (activar debug). |
| Correo en spam | Revisar SPF/DKIM/DMARC; ajustar `from` consistente con dominio autenticado. |
| NO_RECIPIENT | Completar email paciente o enviar `to` explícito. |

Para mayor detalle, activar logs temporales:
```
EMAIL_DEBUG=1
```
(Añadir condición en servicio para emitir detalles — implementar con cuidado para no loguear `pass`).

---
## 13. Buenas Prácticas de Operación Continua
- Verificar envíos reales semanalmente (sample aleatorio).
- Monitorear tasa de rebotes (si proveedor API integrado en el futuro).
- Revisar expiración de App Password (algunos proveedores la invalidan al cambiar MFA).
- Documentar rotaciones (fecha, responsable) en registro interno.

---
## 14. Checklist Rápido
| Paso | Estado |
|------|--------|
| Definir estrategia (global vs per-tenant) | ☐ |
| Completar campos SMTP (UI o .env) | ☐ |
| Probar envío de orden real | ☐ |
| Configurar SPF/DKIM/DMARC | ☐ |
| Documentar credenciales y rotación | ☐ |
| Revisar spam / deliverabilidad | ☐ |
| Programar próxima rotación (fecha) | ☐ |

---
## 15. Referencias Internas
- UI: `IntegrationsSettingsTab.jsx` nuevos campos `smtp.*`.
- Endpoint: `server/routes/workOrders.js` (`/send-report/email`).
- Servicio: `server/services/emailReportSender.js`.
- Tabla config: `lab_configuration.integrations_settings`.

---
## 16. Ejemplo Completo Multi-Tenant
Tenant A (UI):
```json
{"smtp":{
  "host":"smtp.gmail.com",
  "port":587,
  "secure":false,
  "user":"no-reply@tenantA.com",
  "pass":"<app-pass>",
  "from":"Laboratorio A <no-reply@tenantA.com>",
  "replyTo":"atencion@tenantA.com"
}}
```
Tenant B (UI):
```json
{"smtp":{
  "host":"smtp.office365.com",
  "port":587,
  "secure":false,
  "user":"notificaciones@tenantB.com",
  "pass":"<app-pass>",
  "from":"Lab B Diagnósticos <notificaciones@tenantB.com>"
}}
```
ENV global (fallback si un tenant no define SMTP):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=0
SMTP_USER=default@laboratorio.com
SMTP_PASS=<app-pass-global>
SMTP_FROM="Laboratorio Clínico Central <default@laboratorio.com>"
```

---
## 17. Próximos Pasos Sugeridos
- Implementar auditoría para cambios en `integrations_settings.smtp`.
- Añadir test de integración que simule uso per-tenant vs ENV.
- Crear script de verificación `node server/tools/test-smtp.js` (futuro).

---
**Fin de la guía.**
