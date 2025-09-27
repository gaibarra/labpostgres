# Configuración: Manejo de Secretos, Masking y Metadata

Este documento describe el contrato actual de la API y del frontend para la gestión de claves sensibles (API keys) dentro de la sección de **Integraciones**.

## Objetivos
- Evitar exponer valores completos de secretos a usuarios no administradores.
- Proveer una vista consistente (preview/masking) para indicar que un secreto existe sin revelar su valor.
- Mantener un rastro de auditoría (metadata) sobre creación, rotación y eliminación.
- Permitir rotación y borrado seguro (con confirmación a través de guardado explícito).

## Campos relevantes
En el objeto `integrations` se manejan algunos secretos (ejemplos):
- `openaiApiKey`
- `deepseekKey`
- `perplexityKey`
- `emailApiKey`
- `whatsappApiKey`
- `telegramBotToken`

### Campos de preview
Para cada secreto principal puede existir un campo `XxxPreview` (actualmente implementado para `openaiApiKey` como `openaiApiKeyPreview`). Este campo sólo contiene una versión enmascarada parcial, suficiente para:
- Mostrar al usuario que la clave está guardada.
- Indicar últimos 4 caracteres (o un subset) para validar visualmente que la rotación se aplicó.

Formato típico de preview: `sk-AB12***Z9XK` (prefijo + `***` + últimos 4). El patrón exacto puede variar por proveedor pero debe **no permitir reconstruir** el secreto completo.

## Metadata (`integrations._meta`)
La tabla de configuración incluye una columna JSONB `integrations_meta` (expuesta como `_meta` dentro de `integrations`). Ejemplo:
```json
"integrations": {
  "openaiApiKeyPreview": "sk-AB12***Z9XK",
  "_meta": {
    "openaiApiKey": {
      "updatedAt": "2025-09-25T22:13:41.120Z",
      "updatedBy": "user-123",
      "last4": "Z9XK"
    },
    "emailApiKey": {
      "updatedAt": "2025-09-20T10:05:12.000Z",
      "updatedBy": "user-456",
      "last4": "9Q2L"
    }
  }
}
```

### Estructura por secreto
- `updatedAt`: ISO timestamp de última creación o rotación.
- `updatedBy`: identificador del usuario que estableció/rotó la clave.
- `last4`: últimos 4 caracteres almacenados (permitido porque no expone el valor completo y ayuda a validar rotaciones).
- `removedAt`: (sólo presente tras un borrado) timestamp de eliminación.
- `removedBy`: usuario que solicitó el borrado.

Cuando se elimina un secreto (en UI se asigna `null` y se guarda), la respuesta mostrará en `_meta.<secret>`:
```json
{
  "removedAt": "2025-09-26T08:15:00.000Z",
  "removedBy": "user-123",
  "last4": "Z9XK" // opcional: puede conservarse para un mínimo rastro histórico
}
```
El campo de valor real (`openaiApiKey`, etc.) se omite en la respuesta normal para usuarios no admin.

## Comportamiento de la API
### GET /config
- Para usuarios no administradores: devuelve secretos omitidos y sólo los campos `*Preview` + `_meta` sanitizada.
- Para administradores (ruta actual estándar): se aplica lógica de masking para evitar exponer accidentalmente la clave completa salvo que se agregue endpoint explícito con privilegio reforzado.

### PATCH /config
- Parámetros enviados con valor `null` -> Solicitud de borrado definitivo del secreto.
- Cadena vacía `""` -> Interpretado como "no cambiar" (el backend ignora sobrescritura vacía si existe valor previo). La UI gestiona este comportamiento preservando localmente el estado.
- Nueva cadena no vacía (ej. `sk-NEW...`) -> Rotación/creación. Se recalcula preview y se actualiza metadata.

### Self-healing de columna
Si la columna `integrations_meta` no existe (p.ej. entorno donde faltó migración), el backend intenta un `ALTER TABLE` dinámico para crearla y continuar la operación, evitando fallos 500 y permitiendo migración paulatina.

## Flujo en el Frontend
1. Al cargar configuración, si sólo viene `openaiApiKeyPreview` y no `openaiApiKey`, el contexto marca el input como vacío pero muestra preview y metadata (indicando que la clave existe).
2. Si el usuario escribe algo en el input, se considera rotación (nuevo valor completo) y se enviará en el PATCH.
3. Botón "Borrar" cambia el valor local a `null`; sólo se persiste al presionar "Guardar Cambios".
4. Tras respuesta, el contexto reconstruye estado: secreto real no se mantiene en memoria si backend lo enmascara; se conserva preview y flags para UX.

## Diferencias Semánticas
| Acción | Valor enviado | Resultado | Metadata |
|-------|---------------|-----------|----------|
| Crear nueva clave | `"sk-..."` | Se guarda y se genera preview | `updatedAt`, `updatedBy`, `last4` |
| Rotar clave | `"sk-..."` distinto | Reemplaza valor anterior y actualiza preview | `updatedAt` cambia, `last4` cambia |
| Mantener clave | `""` (input vacío) | No cambia valor | Metadata sin cambios |
| Borrar clave | `null` | Se elimina secreto (omitido en GET) | `removedAt`, `removedBy`, (opcional `last4`) |

## Ejemplo de Solicitudes
### Rotar clave OpenAI
```http
PATCH /config
Content-Type: application/json

{
  "integrations": { "openaiApiKey": "sk-NEW-1234567890" }
}
```
Respuesta (mascarada):
```json
{
  "integrations": {
    "openaiApiKeyPreview": "sk-NEW-***7890",
    "_meta": {
      "openaiApiKey": { "updatedAt": "2025-09-26T11:00:00.000Z", "updatedBy": "u1", "last4": "7890" }
    }
  }
}
```

### Borrar clave
```http
PATCH /config
{
  "integrations": { "openaiApiKey": null }
}
```
Respuesta:
```json
{
  "integrations": {
    "_meta": {
      "openaiApiKey": { "removedAt": "2025-09-26T11:10:00.000Z", "removedBy": "u1", "last4": "7890" }
    }
  }
}
```

## Buenas Prácticas
- No loggear secretos completos (el backend evita incluirlos en logs de consola; verificar cualquier `console.log`).
- Rotar claves regularmente (al menos trimestral) y después de incidentes de seguridad.
- Limitar quién tiene acceso al endpoint futuro de secretos completos (idealmente require MFA / token temporal adicional).
- Añadir monitoreo de eventos de rotación y borrado en auditoría central.

## Próximos Pasos Planeados
- Endpoint dedicado `/config/integrations` (sólo admin) para obtención controlada de valor completo bajo circunstancias especiales.
- Tests adicionales de metadata para cada campo secreto.
- Migración/limpieza definitiva del alias legacy `openAIKey`.

---
Actualizado: 2025-09-26
