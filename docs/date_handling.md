# Política de manejo de fechas (Civil Dates)

Este proyecto trata ciertas fechas (actualmente `patients.date_of_birth`) como *fechas civiles* puras, sin componente horario ni zona ("civil dates").

## Objetivos
- Evitar desplazamientos de día causados por conversiones de zona horaria (ej. UTC ↔ local) al serializar/deserializar.
- Garantizar consistencia absoluta entre lo que ingresa el usuario y lo que se persiste y muestra.
- Facilitar validaciones y comparaciones lexicográficas simples.

## Almacenamiento en BD
- Tipo de columna: `DATE` (PostgreSQL). Este tipo no almacena hora ni zona.
- No se usan `TIMESTAMP` / `TIMESTAMPTZ` para fechas civiles.

## Formato en API
- Siempre una cadena estricta `YYYY-MM-DD` o `null` si el campo es opcional.
- El backend acepta temporalmente (tolerancia) strings ISO completas (`YYYY-MM-DDTHH:mm:ss[.SSS]Z`) pero **las normaliza** truncando desde la `T` hacia la derecha.
- La respuesta de la API nunca incluye la parte horaria; siempre retorna únicamente `YYYY-MM-DD`.

## Validación
Se usa un esquema regex en Zod:
```
/^(19|20|21|18|17)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
```
(Ajustable: actualmente cubre años 1700-2199; adaptar según reglas de negocio si se requieren otros rangos.)

Entradas rechazadas de ejemplo:
- `2024/01/01`
- `01-01-2024`
- `2024-13-01`
- `2024-00-10`
- `2024-02-30`

Entradas aceptadas y normalizadas (se guardan/retornan como a la izquierda):
| Entrada enviada | Guardado / Devuelto |
|-----------------|----------------------|
| `1990-05-12` | `1990-05-12` |
| `1990-05-12T00:00:00.000Z` | `1990-05-12` |
| `1990-05-12T03:15:10Z` | `1990-05-12` |

## Serialización de Respuestas
Se aplica un helper `normalizeCivilDate` antes de enviar datos al cliente asegurando que:
- Valores `null` permanecen `null`.
- Cadenas que contienen `T` se truncan (strip) hasta dejar solo la porción `YYYY-MM-DD`.

## Frontend (React)
Buenas prácticas:
- Tratar estas fechas como strings inmutables; **no** hacer `new Date(value)` ni `parseISO(value)`.
- Para mostrar formato local (ej. `DD/MM/YYYY`), dividir por guiones y reordenar: `const [y,m,d] = value.split('-')`.
- Para inputs HTML `<input type="date">` se puede enlazar directamente la cadena `YYYY-MM-DD`.

## Razones para evitar Date objects
Los objetos `Date` en JS siempre asumen un huso al parsear (UTC o local), provocando desplazamientos de día según la TZ del navegador/servidor. Esto causa los bugs clásicos de -1 día en zonas negativas (America/*) cuando se interpretan medianoches UTC.

## Extensión a nuevos campos
Si se agregan otros campos (p.ej. `published_on`, `effective_date`) que representen fechas civiles:
1. Usar tipo `DATE` en la base de datos.
2. Reutilizar el helper `normalizeCivilDate`.
3. Aplicar el mismo patrón regex para validación.
4. Documentar el campo en esta página si tiene reglas particulares (rango mínimo/máximo).

## Testing
Casos cubiertos por la suite:
- Normalización de una fecha con parte horaria a `YYYY-MM-DD`.
- Persistencia exacta de fechas históricas potencialmente vulnerables a desplazamientos (ej. `1965-01-03`).

Casos sugeridos adicionales (si aún no existen):
- Fechas inválidas variadas retornan 400.
- Campo opcional acepta `null`.

## Diferenciación con DateTime
Para campos que realmente requieren tiempo y zona (no implementados aún), se debería:
- Usar `TIMESTAMPTZ` en PostgreSQL.
- Serializar en ISO UTC explícito (`YYYY-MM-DDTHH:mm:ss.SSSZ`).
- Mantener completamente separados de los *civil dates* para evitar confusión.

## Resumen
| Aspecto | Civil Date (DOB) | DateTime (futuro) |
|---------|------------------|-------------------|
| Tipo DB | DATE | TIMESTAMPTZ |
| Zona | No aplica | UTC (normalizada) |
| Formato API | `YYYY-MM-DD` | ISO completo UTC |
| Front parsing | String ops | `Date` / libs especializadas |

## Mantención
Al introducir un nuevo endpoint, revisar esta política para confirmar si el campo sigue la semántica de fecha civil antes de copiar lógica de otros lugares.

---
Última actualización: 2025-09-28
