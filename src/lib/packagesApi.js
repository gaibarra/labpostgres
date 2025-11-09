import { apiClient } from './apiClient';

// Mapeo de códigos de error backend a mensajes amigables
const packageItemErrorMessages = {
  PACKAGE_ITEM_DUPLICATE: 'El análisis ya está en este paquete.',
  PACKAGE_ITEM_POSITION_CONFLICT: 'La posición indicada ya está ocupada en el paquete.',
  PACKAGE_NOT_FOUND: 'El paquete no existe o ya fue eliminado.',
  PACKAGE_ITEM_TARGET_NOT_FOUND: 'El estudio seleccionado no existe.',
  FOREIGN_KEY_NOT_FOUND: 'Referencia no encontrada (paquete o estudio).',
  BAD_UUID: 'Identificador inválido. Verifica y vuelve a intentar.',
  NOT_NULL_VIOLATION: 'Falta un valor requerido para completar la acción.',
  CHECK_CONSTRAINT_VIOLATION: 'La información enviada no cumple una regla interna.',
  DEADLOCK_RETRY: 'Conflicto momentáneo. Reintentando automáticamente…',
  UNIQUE_OR_INTEGRITY_CONFLICT: 'Conflicto de integridad. Revisa duplicados o posiciones.',
  RLS_FORBIDDEN: 'No tienes permisos para modificar este paquete.',
  PACKAGE_ITEMS_TABLE_MISSING: 'Estructura de items no migrada en este tenant (contacta soporte).',
  PACKAGE_ITEMS_COLUMN_MISSING: 'Falta columna requerida (migra la base antes de continuar).',
  PG_FUNCTION_MISSING: 'Función interna faltante. Verifica extensiones PostgreSQL.',
  GENERIC_PACKAGE_ITEM_INTERNAL: 'Fallo interno al procesar el ítem. Intenta nuevamente o contacta soporte.'
};

// Hook opcional para telemetría (el caller puede reemplazarlo)
export let onPackageItemError = (_code, _status) => { /* noop */ };
export function setPackageItemErrorHook(fn){ onPackageItemError = typeof fn === 'function' ? fn : onPackageItemError; }

// Obtener items de un paquete (ordenados por position en backend)
export async function getPackageItems(packageId) {
  return apiClient.get(`/packages/${packageId}/items`);
}

// Agregar un estudio al paquete; opcionalmente insertar en una position específica
export async function addPackageItem(packageId, { itemId, position, itemType = 'analysis' }) {
  const body = { item_id: itemId, item_type: itemType };
  if (typeof position === 'number') body.position = position;
  let attempt = 0;
  while (attempt < 2) { // hasta 1 retry automático para DEADLOCK
    try {
      const res = await apiClient.post(`/packages/${packageId}/items`, body);
      return res;
    } catch (e) {
      const code = e?.code;
      const status = e?.status;
      if (code) onPackageItemError(code, status);
      // Reintento si DEADLOCK_RETRY
      if (code === 'DEADLOCK_RETRY' && attempt === 0) {
        attempt++;
        // Pequeño delay exponencial básico
        await new Promise(r => setTimeout(r, 150 + Math.random()*150));
        continue;
      }
      const isKnownStatus = status === 409 || status === 404 || status === 400 || status === 403 || status === 503 || status === 500;
      if (isKnownStatus && code && packageItemErrorMessages[code]) {
        const friendly = new Error(packageItemErrorMessages[code]);
        friendly.code = code;
        friendly.status = status;
        throw friendly;
      }
      // Fallback genérico mejorado
      if (code && !packageItemErrorMessages[code]) {
        const generic = new Error('No se pudo agregar el ítem (código: '+code+').');
        generic.code = code;
        generic.status = status || 500;
        throw generic;
      }
      throw e; // No code -> error inesperado original
    }
  }
}

// Reordenar ítems de un paquete tomando el arreglo completo de IDs en el orden deseado
export async function reorderPackageItems(packageId, itemIds) {
  return apiClient.patch(`/packages/${packageId}/items/reorder`, { itemIds });
}

// Actualizar encabezado del paquete (name, description, price)
export async function updatePackage(packageId, data) {
  return apiClient.put(`/packages/${packageId}`, data);
}

// Utilidad: devolver un nuevo arreglo moviendo un elemento de startIndex a endIndex
export function reorderList(list, startIndex, endIndex) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}
