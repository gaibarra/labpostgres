# Manual del Usuario – Aplicación de Laboratorio

Guía práctica y detallada para usuarios finales (recepción, técnicos, validadores y médicos) sobre cómo operar la aplicación en el día a día.

## Índice
- [1) Perfiles y permisos](#1-perfiles-y-permisos)
- [2) Inicio rápido](#2-inicio-rápido)
- [3) Acceso y cuenta](#3-acceso-y-cuenta)
- [4) Elementos comunes de la interfaz](#4-elementos-comunes-de-la-interfaz)
- [5) Pacientes](#5-pacientes)
- [6) Estudios (catálogo)](#6-estudios-catálogo)
  - [6.1) Campos del estudio](#61-campos-del-estudio)
  - [6.2) Parámetros del estudio](#62-parámetros-del-estudio)
  - [6.3) Valores de referencia (detalle)](#63-valores-de-referencia-detalle)
- [7) Órdenes de trabajo](#7-órdenes-de-trabajo)
  - [7.1) Crear una orden paso a paso](#71-crear-una-orden-paso-a-paso)
  - [7.2) Estados de la orden y edición](#72-estados-de-la-orden-y-edición)
- [8) Captura y validación de resultados](#8-captura-y-validación-de-resultados)
  - [8.1) Antibiograma (microbiología)](#81-antibiograma-microbiología)
- [9) Reportes finales](#9-reportes-finales)
- [10) Paquetes](#10-paquetes)
- [11) Referenciadores](#11-referenciadores)
- [12) Finanzas](#12-finanzas)
- [13) Búsqueda, filtros y tablas](#13-búsqueda-filtros-y-tablas)
- [14) Consejos y buenas prácticas](#14-consejos-y-buenas-prácticas)
- [15) Resolución de problemas (FAQ)](#15-resolución-de-problemas-faq)
- [16) Glosario básico](#16-glosario-básico)
- [17) Soporte](#17-soporte)
 - [18) Seguridad y sesión](#18-seguridad-y-sesión)

---

## 1) Perfiles y permisos
- Recepción: alta/edición de pacientes, creación de órdenes.
- Técnico: captura de resultados.
- Validador/Médico: revisión y validación, liberación de reportes.
- Administrador: configuración avanzada, usuarios/roles, estudios y parámetros.

Las opciones visibles pueden variar según tu rol.

## 2) Inicio rápido
- Inicia sesión con tu correo y contraseña.
- Usa el menú lateral para navegar: Tablero, Órdenes, Pacientes, Estudios, Paquetes, Referenciadores, Finanzas y Administración.
- Cambia a modo claro/oscuro con el botón de tema en el encabezado.

## 3) Acceso y cuenta
- Crear cuenta: normalmente la crea un administrador.
- Iniciar sesión: email + contraseña en la pantalla de Login.
- Olvidé mi contraseña: utiliza “¿Olvidaste tu contraseña?” y sigue el enlace enviado a tu correo.
- Perfil: desde tu avatar podrás ver tus datos (si está habilitado).
- Cerrar sesión: en el menú de usuario.

## 4) Elementos comunes de la interfaz
- Encabezado: título de la sección y accesos (tema, usuario, acciones rápidas).
- Menú lateral: navegación entre módulos.
- Tablas: con paginación/filtros/ordenamiento cuando aplica.
- Botones y estados:
  - Guardar/Actualizar: aplica cambios.
  - Cancelar: cierra sin guardar.
  - Toasts (notificaciones): confirman éxitos o muestran errores.

## 5) Pacientes
### 5.1) Ver y buscar
- Entra a “Pacientes” para listar. Busca por nombre u otros datos.

### 5.2) Crear/Editar paciente
1. “Nuevo Paciente” o selecciona uno existente.
2. Captura datos básicos (nombre completo, fecha de nacimiento, sexo, datos de contacto).
3. Guarda. Los campos obligatorios se señalarán si faltan.

### 5.3) Historial clínico y gráficas
- Filtros: por estudio y/o parámetro.
- Tabla de resultados históricos (fecha, estudio, parámetro, resultado).
- Gráfica: disponible cuando existen múltiples resultados numéricos del mismo parámetro.

## 6) Estudios (catálogo)
Consulta, crea o edita los estudios que ofrece el laboratorio.

### 6.1) Campos del estudio
- Nombre: título del estudio (obligatorio).
- Clave: código corto; si lo dejas vacío se genera automáticamente.
- Categoría: p. ej., Hematología, Química, etc. (obligatorio).
- Precio particular: precio estándar (si aplica listas por referenciador, puede variar).
- Descripción e Indicaciones: texto para preparar al paciente.
- Muestra: tipo y contenedor.
- Tiempo de proceso (horas): referencia operativa.

### 6.2) Parámetros del estudio
Cada estudio puede tener uno o más parámetros a reportar.

Campos del parámetro:
- Nombre: único dentro del estudio (obligatorio).
- Unidades: p. ej., mg/dL, %, UI/L.
- Decimales: cantidad de decimales a mostrar/guardar.
- Grupo: para agrupar en el reporte (opcional).

Acciones:
- Añadir parámetro: abre el formulario del parámetro.
- Editar parámetro: modifica datos existentes.
- Eliminar parámetro: quita el parámetro (si ya existe en DB, puede requerir permisos).
- Reordenar: usa flechas “arriba/abajo” por fila. El orden se guarda automáticamente y determina el orden de captura y reporte.

### 6.4) Asistencia IA para parámetros
Puedes acelerar la creación de un nuevo parámetro con la opción de “Asistencia IA” (si está habilitada por el administrador):

1. En el estudio, elige “Añadir parámetro con IA” o la acción equivalente.
2. Ingresa el nombre deseado (p. ej., “Colesterol HDL”). Opcionalmente, agrega un prompt/nota.
3. El sistema crea un proceso asíncrono y te muestra el avance; al finalizar, propone:
  - Nombre, unidad y número de decimales.
  - Rangos de referencia por sexo/edad. Algunas especialidades (hematología) usan plantillas internas consistentes.
4. Revisa y ajusta los valores antes de guardar. Si no hay clave de IA, se usa un modo “stub” determinista.

Notas:
- La IA no usa datos personales del paciente; trabaja con metadatos del estudio.
- Es responsabilidad del laboratorio validar clínicamente los rangos propuestos.

Tour visual: consulta `docs/tours/ai_param_tour.md` para un recorrido con capturas.

### 6.3) Valores de referencia (detalle)
Agrega uno o varios registros por parámetro para reflejar diferencias por sexo y edad.

Campos por registro de referencia:
- Sexo: Ambos, Masculino o Femenino.
- Unidad de edad: años, meses o días.
- Edad mínima/máxima: límites del rango de edad aplicable (pueden ser nulos si no aplica).
- Tipo de valor:
  - Numérico: define Normal mín./máx. (y decimales según el parámetro).
  - Alfanumérico o Texto libre: usa texto permitido o libre.
- Notas: aclaraciones clínicas.

Recomendaciones:
- Evita solapamientos de edad/sexo para el mismo parámetro.
- Si el parámetro es textual, no definas rangos numéricos.

## 7) Órdenes de trabajo
### 7.1) Crear una orden paso a paso
1. “Nueva Orden”.
2. Paciente: selecciona uno o crea un nuevo.
3. Referenciador: elige médico o institución (opcional según flujo).
4. Estudios y/o Paquetes: selecciona los que correspondan.
5. Precios: revisa totales; aplica descuento y/o anticipo si procede.
6. Notas: agrega instrucciones o comentarios.
7. Guardar: se genera un folio (fecha + consecutivo).

### 7.2) Estados de la orden y edición
- Pendiente: editable.
- En proceso: puede estar parcialmente capturada.
- Validada: resultados cerrados y lista para reporte.
Nota: según configuración, ciertos cambios pueden quedar bloqueados al validar.

## 8) Captura y validación de resultados
1. Abre la orden → “Capturar/Validar Resultados”.
2. Ingresa resultados por parámetro:
   - Numéricos: respeta los decimales del parámetro; se redondea según configuración.
   - Textuales: usa el campo de texto (permitido/libre según el parámetro).
3. Guarda para conservar avances.
4. Valida para cerrar resultados y habilitar la previsualización del reporte final.

Consejos:
- Si un parámetro no aplica, déjalo en blanco o sigue el criterio del laboratorio.
- Revisa los valores de referencia visibles para contexto clínico.

### 8.1) Antibiograma (microbiología)
Cuando la orden incluye estudios de microbiología, puedes capturar resultados de antibiograma:

1. Abre la orden → “Antibiograma”.
2. Completa los datos generales del aislamiento:
  - Organismo, tipo de espécimen, método (p. ej., disco difusión), estándar (CLSI/EUCAST) y su versión.
3. Agrega resultados por antibiótico:
  - Código/Nombre del antibiótico (lista del catálogo).
  - Tipo de medida: ZONA (mm) o MIC (µg/mL).
  - Valor numérico y unidad.
  - Interpretación: S (Sensible), I (Intermedio) o R (Resistente).
  - Comentarios (opcional).
4. Guarda. Las filas pueden actualizarse (upsert) o eliminarse.

Sugerencias:
- Usa el buscador para filtrar antibióticos por clase o nombre.
- Verifica que el estándar y versión correspondan al protocolo vigente del laboratorio.

Tour visual: consulta `docs/tours/antibiograma_tour.md` para un recorrido con capturas.

## 9) Reportes finales
- Previsualización: disponible tras validar.
- Contenido: datos del paciente, estudios, parámetros, resultados y referencias.
- Exportación/Impresión: usa la opción de imprimir del navegador o la descarga en PDF cuando esté disponible.

## 10) Paquetes
- Agrupan varios estudios para su venta y registro conjunto.
- En órdenes, al elegir un paquete se agregan automáticamente sus estudios.
 - Orden de procesamiento: puedes controlar el orden de los estudios dentro del paquete; ese orden se respeta al agregarlos a la orden y en el flujo de captura/reportes.
   - Reordenar: usa las flechas o la opción "Reordenar" en la vista del paquete para mover ítems arriba/abajo.
   - El sistema evita duplicar el mismo estudio dentro del paquete y asigna una posición única por paquete.

## 11) Referenciadores
- Alta/edición de médicos e instituciones.
- Listas de precio específicas por referenciador (si está configurado).

## 12) Finanzas
- Cuentas por cobrar, ingresos/egresos y reportes.
- El acceso y alcance dependen de tus permisos.

## 13) Búsqueda, filtros y tablas
- Búsqueda por texto cuando esté disponible.
- Filtros por columnas (categoría, estado, etc.).
- Ordenar por encabezados (A/Z, valores numéricos o por fecha).
- Paginación en listados grandes.

## 14) Consejos y buenas prácticas
- Usa modo oscuro en ambientes con poca luz.
- Guarda con frecuencia y verifica los toasts de confirmación.
- Escribe resultados claros y coherentes con los parámetros.
- Respeta el orden lógico de parámetros definido por el laboratorio.
- Protege datos personales: no compartas credenciales ni dejes sesiones abiertas.

## 15) Resolución de problemas (FAQ)
- No puedo iniciar sesión:
  - Verifica email/contraseña. Usa “Olvidé mi contraseña”. Si persiste, contacta al administrador.
- No veo un estudio o paquete:
  - Puede ser por permisos o configuración. Solicita revisión a Administración.
- No puedo capturar/editar resultados:
  - La orden podría estar validada. Solicita reversión o permisos adicionales.
- El orden de parámetros no cambia:
  - Usa las flechas por fila. Si tras refrescar no se guarda, informa a Administración.
- Los rangos de referencia no aparecen como espero:
  - Revisa sexo/edad del paciente y que no existan solapamientos en el catálogo.

## 16) Glosario básico
- Estudio: análisis clínico solicitado (p. ej., Biometría, Glucosa).
- Parámetro: medición específica dentro de un estudio (p. ej., Hemoglobina).
- Valores de referencia: rangos/textos esperados por edad/sexo.
- Orden: solicitud de estudios para un paciente con folio y estado.
- Referenciador: médico o institución que remite o recibe resultados.

## 17) Soporte
- Incidencias o dudas: contacta a tu administrador interno o al área de TI del laboratorio.

---

Este manual es una guía general; algunas opciones pueden variar según la configuración y permisos de tu cuenta.

## 18) Seguridad y sesión

- Inicio de sesión: puede usar token Bearer y además una cookie de sesión httpOnly. Esto ayuda a proteger la sesión en el navegador.
- Cerrar sesión: invalida tu token/cookie de inmediato; si la vuelves a enviar, el sistema la rechaza por seguridad.
- Buenas prácticas:
  - No compartas credenciales ni dejes la sesión abierta en equipos públicos.
  - Usa contraseñas robustas y cambia periódicamente según política interna.
  - Ante sospecha de acceso no autorizado, cierra sesión en todos los dispositivos y contacta a tu administrador.
