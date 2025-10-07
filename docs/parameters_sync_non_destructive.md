# Política de sincronización no destructiva de parámetros y rangos (Oct 2025)

## Resumen
Históricamente, el endpoint `POST /api/analysis/:id/parameters-sync` eliminaba **siempre** los rangos (`reference_ranges`) existentes de cada parámetro antes de insertar los nuevos, incluso si el frontend enviaba un array vacío (o perdía el estado de los rangos). Esto provocaba pérdida silenciosa de datos clínicos cuando:

- El formulario de edición no rehidrataba `valorReferencia`.
- Se enviaba un payload parcial sólo para cambiar el nombre/unidad.
- Ocurrían race conditions en UI que resultaban en `valorReferencia: []`.

## Nuevo comportamiento
A partir de esta modificación (commit Oct 2025):

1. Si un parámetro en el payload **no incluye** la propiedad `valorReferencia` (ni `reference_ranges`), se preservan intactos los rangos existentes.
2. Si la propiedad existe pero su valor es `undefined` o `null`, también se preservan.
3. Si la propiedad es un array vacío `[]`, se asume *posible pérdida de estado en la UI* y se preservan los rangos (no se borra) **a menos que** se especifique `clearRanges: true`.
4. Sólo se reemplazan los rangos (DELETE + INSERT) cuando:
   - Hay un array con al menos un elemento válido, o
   - Se envía explícitamente `clearRanges: true` (aunque el array esté vacío) para forzar el borrado.

## Flag `clearRanges`
Para borrar intencionalmente todos los rangos de un parámetro:
```jsonc
{
  "id": 123,
  "name": "VCM",
  "unit": "fL",
  "valorReferencia": [],
  "clearRanges": true
}
```

## Logging opcional
Activar variable de entorno:
```
DEBUG_SYNC_RANGES=1
```
Mensajes relevantes:
- `preserve ranges paramId=... (no valorReferencia field)`
- `preserve ranges paramId=... (valorReferencia undefined/null)`
- `skip destructive empty ranges paramId=...` (array vacío ignorado)

## Integridad Hematología
Se añadieron tests:
- `referenceRanges.nonDestructiveSync.test.js`
- `biometriaHematica.nonDestructiveIntegrity.test.js`

Verifican que omitir `valorReferencia` o enviar array vacío no borra rangos y que `clearRanges` funciona.

## Backfill
Script: `server/scripts/backfillBiometriaHematicaRanges.js`
- Inserta rangos estándar para VCM, HCM, Hemoglobina si están ausentes.
- Uso: `node server/scripts/backfillBiometriaHematicaRanges.js --dry` para simulación; quitar `--dry` para ejecutar.

## Recomendaciones frontend
- Sólo incluir `valorReferencia` en el payload cuando el usuario haya modificado realmente los rangos.
- Para eliminar todos los rangos, establecer `valorReferencia: []` y `clearRanges: true`.
- Evitar construir arrays vacíos por defecto al mapear formularios parcialmente cargados.

## Futuras mejoras (pendientes)
- Diff inteligente para actualizar sólo rangos modificados (evitar DELETE masivo).
- Historial/audit trail detallado de cambios de rangos.
- Validación opcional de continuidad 0–120 configurable por tipo de estudio.

---
Mantener este documento actualizado cuando se introduzcan flags adicionales o se implemente diff incremental.
