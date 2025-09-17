import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import apiClient from '@/lib/apiClient';

/**
 * Envía un evento de auditoría al backend. El backend asigna performed_by usando el JWT.
 * Si el usuario no tiene permiso 'administration:view_audit_log', la llamada devolverá 403;
 * en ese caso silenciamos el error para no interrumpir el flujo normal.
 */
export const logAuditEvent = async (action, details = {}) => {
  if (!action) return;
  try {
    await apiClient.post('/audit', { action, details });
  } catch (e) {
    if (e?.status === 403) {
      // Usuario sin permiso para registrar (o endpoint protegido). Silencioso.
      if (import.meta.env.DEV) console.debug('[audit] permiso insuficiente para registrar acción', action);
      return;
    }
    // Otros errores se registran para diagnosticar.
    console.error('[audit] Error enviando evento', action, e);
  }
};

export const getFormattedTimestamp = (isoTimestamp) => {
  if (!isoTimestamp) return 'Fecha no disponible';
  try {
    return format(new Date(isoTimestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return isoTimestamp;
  }
};