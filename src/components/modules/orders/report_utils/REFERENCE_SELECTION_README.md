# Lógica de Selección de Rangos de Referencia

Este documento describe el algoritmo utilizado en `evaluationUtils.js` para determinar qué rango de referencia mostrar y usar al evaluar resultados de parámetros de laboratorio.

## Objetivos
- Seleccionar un único rango que represente la referencia clínica adecuada para el paciente.
- Priorizar rangos específicos de sexo sobre rangos genéricos ("Ambos") cuando ambos aplican.
- Soportar múltiples unidades de edad (horas, días, semanas, meses, años).
- Manejar rangos abiertos (sin límite inferior o superior) y rangos textuales.

## Flujo de `getApplicableReference`
1. Validaciones iniciales: si faltan parámetros, rangos, fecha de nacimiento o sexo del paciente -> retorna `null`.
2. Normalización de sexo:
   - Entrada del paciente y de cada rango se normaliza a: `masculino`, `femenino`, `ambos` (aceptando variantes: M, F, a, etc.).
3. Limpieza numérica:
   - `age_min` y `age_max` se convierten a `-Infinity` / `Infinity` cuando son nulos o inválidos.
   - Igual para `lower` / `upper` (valores de referencia numéricos).
4. Cálculo de edad del paciente en distintas unidades (derivado de la fecha de nacimiento): horas, días, semanas, meses, años.
5. Filtrado de candidatos:
   - Se retienen rangos cuyo sexo sea `ambos` o coincida exactamente con el sexo normalizado del paciente.
   - La edad del paciente en la unidad del rango debe cumplir: `age_min <= edad <= age_max`.
6. Selección final:
   - Si no hay candidatos -> `null`.
   - Si hay uno o más candidatos exactos (mismo sexo que el paciente, no "ambos") -> se toma el primero exacto.
   - En caso contrario -> se toma el primer candidato (que será de sexo "ambos").

## Motivo de la Prioridad Sexo Específico
Los rangos específicos suelen reflejar diferencias fisiológicas relevantes. Mostrar primero un rango genérico cuando existe uno específico puede confundir o etiquetar erróneamente valores como fuera de rango.

## `getReferenceRangeText`
Formatea el rango aplicable:
- Construye el descriptor de edad:
  - `Todas las edades` cuando ambos límites son infinitos.
  - `≤ X unidad`, `≥ X unidad` para límites abiertos.
  - `min-max unidad` en caso general.
- Construye el texto de valores:
  - Si `text_value` existe -> se usa tal cual.
  - Si ambos límites numéricos son abiertos -> `No aplica`.
  - Si solo uno es abierto -> `≤ upper` o `≥ lower`.
  - Caso normal -> `lower - upper`.

## `evaluateResult`
Clasifica un valor ingresado:
- Si no hay rango aplicable -> `no-evaluable`.
- Si el rango es textual -> `normal` (no se compara numéricamente).
- Si el valor no es numérico -> `no-numerico`.
- Lógica de comparación:
  - Rango totalmente abierto -> `normal`.
  - Abierto inferior (`lower = -Infinity`) y valor > upper -> `alto`.
  - Abierto superior (`upper = Infinity`) y valor < lower -> `bajo`.
  - Menor que lower -> `bajo`.
  - Mayor que upper -> `alto`.
  - En otro caso -> `normal`.

## Casos de Datos Problemáticos Detectados
- Rangos duplicados con superposición total (mismo sexo y edad) pueden introducir ambigüedad.
- Edad de paciente en el borde exacto (ej. 60 años vs 60.0) está cubierta al usar comparaciones inclusivas.
- Rangos ingresados sin unidad de edad (se asume `años`).

## Advertencias (Nueva Validación)
Planeado: emitir `console.warn` cuando existan varios candidatos *exactos* (mismo sexo) para la misma franja de edad. Esto facilita higiene de datos sin bloquear la operación.

## Testing
Archivo: `evaluationUtils.test.js` cubre:
- Selección de rango (sexo específico vs ambos)
- Unidades de edad (años, meses, horas)
- Texto formateado
- Evaluación de resultado (normal, alto, bajo, no-numerico, no-evaluable, rangos abiertos, textuales)

## Futuras Mejores Prácticas
- Añadir validación previa en backend para prevenir solapamientos exactos (constraint lógico).
- Mostrar en UI (tooltip) el ID del rango usado para trazabilidad.
- Endpoint de auditoría para listar parámetros con solapamientos.

---
Última actualización: 2025-10-04
