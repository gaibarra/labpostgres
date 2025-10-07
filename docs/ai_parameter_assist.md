# Asistencia IA: Generación de Parámetro Individual

Este documento describe el contrato (request/response), flujo de jobs asíncronos, banderas de entorno y reglas de fallback para el endpoint que genera un único parámetro de un estudio vía IA.

## Objetivo
Facilitar la creación rápida de un parámetro (nombre, unidad, rango(s) de referencia) complementario a un estudio existente. El servicio intenta usar OpenAI (modelo `gpt-4o-mini`) cuando existe API Key válida y recurre a un stub determinista cuando no es posible (o cuando se fuerza el modo stub).

> Nota: La generación de ESTUDIOS ahora incluye campos adicionales (`description`, `indications`, `sample_type`, `sample_container`, `processing_time_hours`) solicitados explícitamente en el prompt backend.
> (Actualización) También se solicita `category` y el frontend normaliza a un conjunto controlado (HORMONAS, HEMATOLOGIA, BIOQUIMICA, INMUNOLOGIA, MICROBIOLOGIA, COAGULACION, GENETICA, ORINA, GASES, OTROS).

## Endpoints

1. Crear job asíncrono
POST `/api/ai/generate-parameter/async`

2. Consultar estado del job
GET `/api/ai/generate-parameter/job/:id`

## Request: Crear Job
```
POST /api/ai/generate-parameter/async
Content-Type: application/json

{
  "studyName": "Perfil Lipídico",
  "desiredParameterName": "Colesterol HDL",
  "existingParameters": ["Colesterol Total", "Triglicéridos"],   // (opcional, actualmente ignorado en backend pero usado en prompt frontend)
  "prompt": "..."  // (opcional) prompt enriquecido; si se omite el backend genera uno estándar
}
```

Campos obligatorios:
- `studyName`: string (nombre del estudio)
- `desiredParameterName`: string (nombre sugerido por el usuario)

Opcionales:
- `existingParameters`: string[] (para evitar duplicados – hoy no se consume en backend, previsto para evolución)
- `prompt`: string (si se quiere sobreescribir el prompt autogenerado del backend)

## Respuesta inmediata (Job creado)
```
{ "jobId": "job_xxx" }
```
En caso de error de validación (falta de campos): HTTP 400 `{ error: "studyName requerido" | "desiredParameterName requerido" }`.

## Polling del Job
```
GET /api/ai/generate-parameter/job/job_xxx
```
Respuesta:
```
{
  "id": "job_xxx",
  "status": "queued" | "working" | "done" | "error",
  "progress": number,          // 0..100 (aprox)
  "message": "texto de estado",
  "parameter": {                // solo presente en status=done
    "name": "Colesterol HDL",
    "unit": "mg/dL",
    "decimal_places": 0,
    "reference_ranges": [
      {
        "sex": "Ambos|Masculino|Femenino",
        "age_min": number,     // entero (o null en entrada IA; normalizado a 0..120)
        "age_max": number,
        "age_min_unit": "años",
        "lower": number|null,
        "upper": number|null,
        "text_value": string|null,
        "notes": "Sin referencia establecida" | string
      }
    ],
    "notes": "Generado con OpenAI (opcional)" | "Stub IA (fallback)..."
  },
  "error": {                    // solo presente en status=error (modo estricto)
    "message": string,
    "code": string,
    "details": string|undefined
  }
}
```

## Estados y Mensajes
- `queued`: en cola inicial.
- `working`: procesando. Mensajes típicos: `Inicializando`, `Preparando prompt`, `Llamando OpenAI`, `Procesando respuesta`, `Normalizando rangos`, `Fallback stub tras error`.
- `done`: completado con `parameter` presente.
- `error`: fallo definitivo (sólo si se activa modo estricto).

## Estrategia de Generación
1. Determinar si se usa OpenAI o stub:
   - Se usa STUB si: no hay API key válida, `AI_PARAM_FORCE_STUB=1`, o `NODE_ENV=test` sin `AI_PARAM_ALLOW_OPENAI=1`.
2. Prompt enriquecido (cuando no se provee `prompt` custom):
   - Rol: Bioquímico clínico senior.
   - Reglas: JSON estricto, cobertura 0-120 años, decimal_places 0-3, evitar claims regulatorios, permitir null en valores desconocidos, nota estándar `Sin referencia establecida` para rangos sin valores.
   - Nombre conciso y no repetido.
3. Parsing: se fuerza `response_format=json_object`. Se aplican heurísticos de rescate (slice primera llaves, JSON5) si hiciera falta (similar a otros endpoints).
4. Normalización: adaptamos variantes (`reference_ranges`, `valorReferencia`, etc.) a forma interna y garantizamos al menos un rango 0-120 si el modelo no lo produce.
5. Fallback: si ocurre error de llamada o parseo y no estamos en modo estricto -> stub determinista.

## Stub Determinista
Genera:
```
{
  "parameter": {
    "name": desiredParameterName,
    "unit": inferida o vacía,
    "decimal_places": 0|2 (pH),
    "reference_ranges": [
      // 0-120 a o segmentado pediátrico si el nombre sugiere infantil
    ],
    "notes": "Stub IA (fallback). Prompt recibido: sí|no"
  }
}
```
Segmentación pediátrica activada cuando el nombre contiene indicios (neo|pedi|infant|lact|niñ|child).

### Filtrado de rangos completamente vacíos (Frontend)
Al procesar la respuesta para estudios, si al menos un rango posee valores numéricos (`valorMin` o `valorMax`), los rangos donde ambos son `null` se eliminan para evitar mezclar intervalos informativos con placeholders vacíos. Si todos los rangos están vacíos se muestran como un aviso para revisión manual.

### Plantillas Automáticas de Parámetros (Overrides)
Para ciertos parámetros hematológicos y diferenciales (p.ej. Hemoglobina, Hematocrito, Eritrocitos, Plaquetas, VCM, HCM, CHCM, RDW, leucocitos y subpoblaciones) el backend aplica plantillas canónicas internas tras la respuesta de IA. Estas plantillas garantizan:
- Segmentación fija: [0-1],[1-2],[2-12] (unisex) y [12-18],[18-65],[65-120] (sexo diferenciado si aplica).
- Valores numéricos completos sin null para parámetros clave.

Cuando se aplica una plantilla, `ai_meta.overrides.templates` incluye la lista de nombres afectados. Ejemplo:
```
"ai_meta": {
  "source":"openai",
  "model":"gpt-4o-mini",
  "study":"Biometria Hematica",
  "ts":"2025-10-07T12:34:56.000Z",
  "overrides": { "templates": ["Hemoglobina","Hematocrito"] }
}
```

## Banderas de Entorno
- `OPENAI_API_KEY`: clave preferente (si no, se consulta `lab_configuration.integrations_settings.openaiApiKey`/`openAIKey`).
- `AI_PARAM_FORCE_STUB=1`: fuerza siempre stub.
- `AI_PARAM_ALLOW_OPENAI=1`: en entorno `test` permite usar OpenAI (por defecto test -> stub).
- `AI_PARAM_STRICT_ERROR=1`: no hace fallback; el job termina en `error` ante fallo IA/parsing.
- `AI_DEBUG=1`: logs de diagnóstico en consola.

## Códigos de Error (cuando `AI_PARAM_STRICT_ERROR=1`)
- `OPENAI_CALL_FAILED`: fallo HTTP al invocar API.
- `OPENAI_BAD_JSON`: respuesta no parseable.
- Otros: mensaje genérico del throw.

## Consideraciones de Seguridad
- El prompt no debe incluir PHI real ni datos sensibles del paciente; sólo metadatos del estudio.
- La clave OpenAI se obtiene lado servidor; nunca exponerla en respuestas.

## Versionado / Evolución Propuesta
- Futuro: validar contra un `parameterSchema` AJV dedicado (ver sección siguiente) y reemplazar con stub si inválido.
- Añadir caching de prompts y storage de audit (entrada/salida) con hashing reversible parcial.
- Integrar filtrado de unidades contra catálogo interno.

## (Opcional) Validación de Esquema de Parámetro
Pendiente (`TODO`): incorporar AJV para esquema:
```
parameter: {
  name: string (minLength 2)
  unit: string
  decimal_places: integer [0,6]
  reference_ranges: array(min 1) de objetos { sex, age_min, age_max, age_min_unit=='años', lower|null, upper|null, text_value|null, notes }
}
```
Acción futura: si inválido -> si no estricto => stub; si estricto => error.

## Ejemplo de Flujo Frontend
1. Usuario abre diálogo y escribe nombre.
2. Frontend construye prompt enriquecido local (puede diferir ligeramente) y lo envía.
3. Backend crea job y devuelve `jobId`.
4. Frontend hace polling cada ~1.5s hasta `status=done` o timeout.
5. Usuario revisa rangos, acepta y persiste parámetro.

## Timeouts / Retry
- El backend no implementa reintentos internamente (excepto en otros endpoints multi-intento). Aquí: un solo intento de OpenAI; fallback inmediato si no estricto.
- Frontend controla timeout global (5 min) y cancela si excedido.

## Diferencias vs Generación de Estudio
- Este endpoint produce UN parámetro (no lista completa).
- Normalización de rangos más ligera (no segmenta automáticamente todos los intervalos pediátricos salvo en stub).

---
Última actualización: AUTO-DOC generado tras introducir prompt enriquecido (ver commit asociado).

## Nota (2025-10)
La lógica de obtención de la API key se ha homogeneizado con otros módulos: ahora los endpoints de estudios (`/api/ai/generate-study-details*`) y de parámetro individual consultan primero la tabla `lab_configuration` (`integrations_settings.openaiApiKey` u `openAIKey`) y, si no existe valor allí, usan `process.env.OPENAI_API_KEY`. Se cachea en memoria 5 minutos. Con `AI_DEBUG=1` se emite un log como:

```
[AI][getApiKey] fuente=db keyPresent=true preview=sk-ABCD***WXYZ
```

Si observas `fuente=none` o `keyPresent=false`, la clave no está disponible para el proceso y se producirá el error `OpenAI API key no configurada.` al generar estudios.
