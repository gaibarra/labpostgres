# Ayuda Rápida: Gestión de Pacientes

Este documento replica (y amplía ligeramente) el contenido mostrado en el botón de **Ayuda** del módulo *Gestión de Pacientes* dentro de la aplicación.

---
## 1. Flujo Rápido: Añadir / Editar
- Pulsa **Nuevo Paciente** para abrir el formulario.
- El nombre se capitaliza automáticamente (Modo Título). Puedes corregir manualmente antes de guardar.
- Dos opciones al finalizar:
  - **Guardar:** almacena y permanece en la vista de pacientes.
  - **Guardar y Registrar Orden:** guarda y te lleva directo al flujo de creación de una nueva orden para ese paciente.
- Puedes cerrar el formulario con la tecla **ESC**.

## 2. Campos y Validaciones
Campos obligatorios: **Nombre**, **Fecha de Nacimiento**, **Sexo**, **Email**.

| Campo | Notas |
|-------|-------|
| Nombre | Formato automático por palabra. |
| Fecha de Nacimiento | Usada para cálculo de edad y validaciones futuras. |
| Sexo | Valores: Masculino / Femenino (puede ampliarse). |
| Email | Validación de formato básico; muestra mensaje si es inválido. |
| Teléfono / Dirección | Opcionales, recomendados para contacto. |
| Contacto / Teléfono de Contacto | Útiles para emergencias o menores. |
| Historial Clínico (resumen) | Texto breve de contexto, no almacenar diagnósticos extensos. |

Regla: Los campos vacíos se omiten del payload (no se envían al servidor).

## 3. Búsqueda y Filtros
- Barra de búsqueda reactiva (con debounce) por **nombre**, **email** o **teléfono**.
- Resultados se actualizan al escribir (ideal usar 2–3 caracteres mínimos).
- La página actual se mantiene tras crear o eliminar pacientes (con refresco de datos controlado).

## 4. Acciones en la Tabla / Tarjetas
| Acción | Icono | Descripción |
|--------|-------|-------------|
| Historial | Gráfica / estadística | Abre la vista con órdenes y resultados previos. |
| Editar | Lápiz | Reabre el formulario con datos existentes. |
| Eliminar | Bote de basura | Requiere confirmación. Operación irreversible. |

## 5. Atajos y Productividad
- **ESC:** cierra formularios o el diálogo de ayuda.
- **Enter (en formulario):** intenta Guardar (si no hay errores de validación).
- Tras crear un paciente, usar inmediatamente *Guardar y Registrar Orden* reduce clics en recepción.

## 6. Privacidad y Buenas Prácticas
- Verifica datos sensibles (email, fecha) antes de guardar.
- Mantén el Historial Clínico breve; detalles extensos deben residir en módulos clínicos especializados.
- Eliminar sólo cuando sea estrictamente necesario (auditoría / trazabilidad).
- Evita copiar/pegar desde fuentes desconocidas para prevenir caracteres invisibles.

## 7. Errores Comunes
| Problema | Causa | Solución |
|----------|-------|----------|
| "Campos obligatorios" | Falta uno de los 4 campos clave | Completar y volver a guardar. |
| Email inválido | Formato incorrecto | Corregir estructura (ej: usuario@dominio.com). |
| No aparece paciente tras guardar | Filtro de búsqueda activo | Limpiar o ajustar búsqueda. |

## 8. Próximas Mejoras Sugeridas (Opcional)
- Indicador visual de edad calculada en el formulario.
- Autocompletado de dirección (si se integra un servicio externo).
- Validación de duplicados (nombre + fecha de nacimiento + correo) para prevenir registros repetidos.

---
**Última actualización:** Generado automáticamente desde el contenido del diálogo de ayuda.
