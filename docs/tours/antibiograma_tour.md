# Tour visual – Antibiograma (microbiología)

Este tour guía la captura y edición de resultados de antibiograma en órdenes con estudios de microbiología.

## Objetivo
- Registrar resultados por antibiótico (Zonas o MIC) con interpretación S/I/R, y metadatos del aislamiento.

## Requisitos previos
- Orden con estudio(s) de microbiología.
- Permiso para captura de resultados.

## Pasos

1) Abrir la orden y navegar a “Antibiograma”
- Desde la orden de trabajo, accede a la pestaña o sección de antibiograma.

![Acceso a antibiograma](../images/antibio_01_acceso.png)

2) Completar metadatos del aislamiento
- Organismo, tipo de espécimen, método (p. ej., disco difusión), estándar (CLSI/EUCAST) y versión.

![Datos del aislamiento](../images/antibio_02_aislamiento.png)

3) Agregar filas de antibióticos
- Selecciona antibiótico del catálogo, indica tipo de medida (ZONA o MIC), valor y unidad.
- Define interpretación: S (Sensible), I (Intermedio), R (Resistente).

![Filas de antibióticos](../images/antibio_03_filas.png)

4) Guardar (upsert) y edición posterior
- Guarda para registrar los resultados. Puedes actualizar o eliminar filas después.

![Guardar resultados](../images/antibio_04_guardar.png)

## Sugerencias
- Usa los filtros de clase/nombre para encontrar antibióticos rápidamente.
- Verifica que el estándar y versión coincidan con el protocolo vigente del laboratorio.

## Problemas comunes
- “Falta estándar/método”: completa los metadatos antes de guardar.
- “Antibiótico no aparece”: revisa filtros activos o si está marcado como inactivo.

## Enlaces relacionados
- Manual del Usuario → Sección “8.1) Antibiograma (microbiología)” (`docs/manual_usuario.md`)
- Arquitectura (rutas /antibiotics y /antibiogram) → `docs/architecture_diagram.md`
