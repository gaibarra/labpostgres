# Tour visual – Asistencia IA para parámetros

Este tour muestra, paso a paso, cómo generar un nuevo parámetro de estudio con ayuda de IA, revisar los rangos propuestos y guardarlos.

## Objetivo
- Crear rápidamente un parámetro con nombre, unidad, decimales y rangos de referencia segmentados por sexo/edad.

## Requisitos previos
- Permisos para editar el catálogo de estudios.
- La clave de IA (OpenAI) puede estar configurada; si no, el sistema usará un "stub" determinista.
- Acceso a la sección de Estudios en la aplicación.

## Pasos

1) Abrir el estudio
- Navega a “Estudios (catálogo)” y selecciona el estudio donde quieres agregar el parámetro.

![Abrir estudio](../images/ai_param_01_estudio.png)

2) Iniciar Asistencia IA
- Haz clic en “Añadir parámetro con IA” (o el botón equivalente en tu versión).

![Acción Asistencia IA](../images/ai_param_02_boton_ia.png)

3) Completar datos básicos
- Ingresa el nombre deseado (p. ej., “Colesterol HDL”).
- Opcional: escribe un prompt o nota para contextualizar.
- Confirma para crear el job asíncrono.

![Diálogo IA – Datos básicos](../images/ai_param_03_dialogo.png)

4) Seguimiento del proceso
- Verás el estado del job: queued → working → done.
- Si hay errores con IA y no está en modo estricto, se usará el stub.

![Progreso del job](../images/ai_param_04_progreso.png)

5) Revisión de la propuesta
- Se muestran nombre, unidad, decimales y rangos de referencia.
- Para parámetros hematológicos clave, pueden aplicarse plantillas internas que garantizan rangos completos.

![Rangos propuestos](../images/ai_param_05_resultado.png)

6) Ajustes y guardado
- Edita cualquier campo necesario (p. ej., unidades o límites numéricos) y guarda.

![Guardar parámetro](../images/ai_param_06_guardar.png)

## Notas y buenas prácticas
- Verifica la coherencia clínica de los rangos antes de publicar.
- Evita solapamientos entre rangos para el mismo parámetro (sexo/edad).
- Los valores textuales (no numéricos) pueden representarse mediante `text_value`.

## Problemas comunes
- “No hay clave de IA”: el sistema usará el stub y te lo indicará en las notas.
- “Tiempo de espera”: reintenta; revisa conectividad con el backend.
- “Categoría inválida del estudio”: ajusta la categoría a la lista permitida desde el editor.

## Enlaces relacionados
- Manual del Usuario → Sección “6.4) Asistencia IA para parámetros” (`docs/manual_usuario.md`)
- Detalles técnicos del endpoint y banderas → `docs/ai_parameter_assist.md`
- Arquitectura general y flujo IA → `docs/architecture_diagram.md`
