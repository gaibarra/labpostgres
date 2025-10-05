# Diagnóstico y Normalización de Sexo en reference_ranges

## Objetivo
Unificar y estabilizar la validación de `reference_ranges.sex` evitando errores 400 inesperados (`REFERENCE_RANGE_CONSTRAINT_FAIL`).

## Migración de limpieza
Ejecutar:
```
psql ... -f sql/20251004_cleanup_reference_ranges_sex_constraint.sql
```
Efectos:
- Normaliza datos existentes a `Ambos|Masculino|Femenino`.
- Elimina constraints obsoletos relacionados a sex.
- Crea (si falta) `reference_ranges_sex_check` permisivo (permite NULL o tokens capitalizados).

## Endpoint diagnóstico
`GET /api/analysis/sex-diagnostics`
Devuelve:
```json
{
  "mode": "dynamic",
  "reason": "constraint-introspection",
  "allowedTokens": ["Ambos","Masculino","Femenino"],
  "constraints": [ { "conname": "reference_ranges_sex_check", "def": "CHECK ((sex IS NULL) OR (sex = ANY (ARRAY['Ambos'::text,'Masculino'::text,'Femenino'::text])))" } ],
  "ts": 1759620000000
}
```

## Tests añadidos
- `referenceRanges.sexVariants.test.js`: Inserta rangos con múltiples variantes (`ambos`, `AMBOS`, `masculino`, etc.) y verifica retorno canonizado y status 200.

## Debug avanzado
Activar logging previo a insert de rangos:
```
DEBUG_SEX_TOKENS=1 npm run dev:server
```
Verás líneas `[ANALYSIS][SYNC][PRE-INSERT-RANGE]` con `normalizedSex` y `allowedSexTokens`.

## Re-introspección inmediata
Si ocurre una violación `23514`, el backend fuerza un refresco de constraint antes de responder el 400 para reducir falsos positivos tras migraciones recientes.

## Pasos de validación post-migración
1. Ejecutar migración de limpieza.
2. Hacer `GET /api/analysis/sex-diagnostics` y comprobar un único constraint canónico.
3. Correr tests: `npm test -- referenceRanges.sexVariants.test.js`.
4. Probar en UI creación/edición de parámetro con distintos casing de sexo – no debe aparecer 400.

## Solución de problemas
| Síntoma | Causa probable | Acción |
|--------|----------------|--------|
| 400 persiste con tokens correctos | Constraint viejo sobrevivió | Re-ejecutar migración y verificar endpoint diagnóstico |
| Tokens vacíos en endpoint | Falló introspección | Revisar permisos DB y logs `[ANALYSIS][SCHEMA]` |
| UI aún lanza NotFoundError masivo | Error anterior dispara ErrorBoundary | Confirmar que 400 desapareció; si sí, reduce panel de diag y reinicia frontend |

## Notas
- El constraint permite NULL para transición. Si quieres forzar NOT NULL en futuro: `ALTER TABLE reference_ranges ALTER COLUMN sex SET NOT NULL;` tras confirmar que no hay filas con NULL.
