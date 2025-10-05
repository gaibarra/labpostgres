# Procedimiento de Remediación y Auditoría de Sex Constraints

Este documento describe el proceso implantado para normalizar y asegurar la coherencia de los valores de sexo en parámetros y rangos de referencia de análisis de laboratorio.

## Objetivos
- Eliminar variantes legacy incoherentes ("MASC", "Fem.", "femenino", etc.).
- Consolidar en un conjunto canónico reducido: `masculino`, `femenino`, `ambos` (y opcionalmente `no_aplica` / `desconocido` si se habilitan a futuro).
- Mantener compatibilidad con datos históricos mediante un puente (bridge) de normalización al leer / escribir.
- Asegurar que constraints en BD permiten sólo tokens canónicos, excepto durante ventana de migración controlada.

## Resumen de Estrategia
1. **Inventario inicial**: endpoint de auditoría expone todos los sex tokens detectados por estudio / parámetro / rango.
2. **Mapa de normalización in-memory**: se introduce función que mapea cualquier variante legacy al token canónico.
3. **Migraciones**: scripts SQL que:
   - Limpian variantes triviales (`UPDATE ... SET sex = 'masculino' WHERE sex IN (...)`).
   - Añaden constraint CHECK restringiendo a valores canónicos.
   - (Opcional) Crean vista de auditoría consolidada.
4. **Bridge en capa de aplicación**: al insertar o recibir payloads del cliente, se normaliza antes de persistir; al devolver datos, ya salen canónicos.
5. **Verificación post-migración**: se ejecuta script de auditoría para confirmar ausencia de variantes no canónicas.
6. **Tests automatizados**: pruebas que validan que la API rechaza valores inválidos y la vista de auditoría no muestra entradas legacy.

## Pasos Detallados
### 1. Auditoría Inicial
- Endpoint: `GET /api/analysis/sex-constraints-audit`.
- Devuelve lista por análisis incluyendo:
  - Parámetro
  - Rangos con token `sex`
  - Flag `isCanonical` / `isLegacy` (implementado en backend).
- Exportar snapshot antes de migrar para referencia.

### 2. Definición de Tokens Canónicos
```
CANONICAL = {
  masculino: ['m','masc','masculino','hombre','male'],
  femenino: ['f','fem','femenino','mujer','female'],
  ambos: ['ambos','mixto','all','todos']
}
```
- Cualquier token que no matchee se marca para revisión manual.

### 3. Migración SQL (Ejemplo Simplificado)
```sql
-- Normalizar variantes a masculino
UPDATE analysis_reference_ranges
SET sex = 'masculino'
WHERE sex ILIKE ANY (ARRAY['m','masc','masculino','male']);

-- Normalizar variantes a femenino
UPDATE analysis_reference_ranges
SET sex = 'femenino'
WHERE sex ILIKE ANY (ARRAY['f','fem','femenino','female']);

-- Normalizar variantes a ambos
UPDATE analysis_reference_ranges
SET sex = 'ambos'
WHERE sex ILIKE ANY (ARRAY['ambos','mixto','all','todos']);

-- Constraint final (aplicar solo tras limpiar)
ALTER TABLE analysis_reference_ranges
  ADD CONSTRAINT analysis_reference_ranges_sex_chk
  CHECK (sex IN ('masculino','femenino','ambos'));
```

### 4. Bridge en Aplicación
- Función `normalizeSex(value)` usada en:
  - Hooks / servicios antes de guardar parámetros o rangos.
  - Proceso de importación masiva (si existe).
- Evita que nuevos registros introduzcan variantes.

### 5. Verificación Post-migración
Ejecutar:
```
SELECT sex, COUNT(*)
FROM analysis_reference_ranges
GROUP BY sex
ORDER BY 2 DESC;
```
- Asegurar que sólo hay los tres tokens.
- Re-ejecutar endpoint de auditoría (debe marcar todo como canónico).

### 6. Pruebas Automatizadas
- Test de auditoría (`analysis.sexAudit.test.js`) que consume endpoint y verifica `legacyCount === 0`.
- Test de validación de payload rechazando `sex = 'Fem.'` con 400.

### 7. Procedimiento Operacional
1. Deploy de código con normalizador + endpoint auditoría (constraint aplazada).
2. Ejecutar auditoría y exportar CSV de variantes.
3. Lanzar migración de limpieza.
4. Aplicar constraint CHECK.
5. Correr pruebas / endpoint auditoría para confirmar limpieza.
6. Comunicar finalización y cerrar tareas de seguimiento.

### 8. Rollback
- Si la constraint causa errores por casos no cubiertos:
  - `ALTER TABLE ... DROP CONSTRAINT analysis_reference_ranges_sex_chk;`
  - Ajustar mapa de normalización / ampliar limpieza y reinstaurar constraint.

### 9. Monitoreo Continuo
- Métrica (opcional) contador de intentos de inserción rechazados por constraint.
- Alerta si >0 en una ventana de 24h, indicando que algún flujo intenta valores legacy.

## Consideraciones
- Mantener el mapa de normalización en un único módulo para evitar divergencias.
- Documentar claramente en manual de operación que sólo se aceptan los tres tokens.
- Si en el futuro se necesita `no_aplica`, introducir primero en bridge y tests antes de tocar constraint.

---
Actualizado: 2025-10-05
