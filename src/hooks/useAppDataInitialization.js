import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { logAuditEvent } from '@/lib/auditUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import apiClient from '@/lib/apiClient';

export const useAppDataInitialization = () => {
  const { user, loading: isAuthLoading } = useAuth();
  const { isInitialized: areSettingsInitialized } = useSettings();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const initializeData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // 1. Asegurar referente "Particular" mediante endpoint backend (crearlo si no existe)
      try {
        const referrerResp = await apiClient.get('/referrers?search=Particular&limit=1');
        const existingData = referrerResp?.data || referrerResp; // soporta ambos formatos
        const already = Array.isArray(existingData) ? existingData.find(r => (r.name||'').toLowerCase() === 'particular') : null;
        if (!already) {
          await apiClient.post('/referrers', { name: 'Particular', entity_type: 'Particular' });
          toast({ title: "Referente 'Particular' creado", description: 'Se creó el referente por defecto.' });
          await logAuditEvent('referrer:created_default', {});
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('[init] No se pudo verificar/crear referente Particular:', e.message);
      }

      // 2. Asegurar roles por defecto (si endpoint de roles vacío)
      try {
        const roles = await apiClient.get('/roles');
        if (!roles || roles.length === 0) {
          const defaultRoles = [
            { role_name: 'Administrador', permissions: 'ALL' },
            { role_name: 'Técnico de Laboratorio', permissions: { patients: ['read'], orders: ['read_assigned','enter_results','update_status'] } },
            { role_name: 'Recepcionista', permissions: { patients:['create','read','update'], referrers:['read'], studies:['read'], packages:['read'], orders:['create','read_all','update_status','print_report','send_report'], finance:['access_accounts_receivable','manage_payments'] } },
            { role_name: 'Flebotomista', permissions: { patients:['read'], orders:['read_assigned','update_status'] } },
            { role_name: 'Invitado', permissions: {} }
          ];
          for (const r of defaultRoles) {
            await apiClient.post('/roles', r);
          }
          await logAuditEvent('roles:seeded_default', { count: defaultRoles.length });
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('[init] No se pudo asegurar roles por defecto:', e.message);
      }
    } catch (error) {
      console.error('Error inicializando datos:', error);
      toast({
        title: 'Error de Inicialización',
        description: `No se pudieron cargar datos iniciales: ${error.message}.`,
        variant: 'destructive'
      });
      await logAuditEvent('init:error', { error: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!isAuthLoading && areSettingsInitialized) {
      initializeData();
    }
  }, [isAuthLoading, areSettingsInitialized, initializeData]);

  return { isLoading };
};