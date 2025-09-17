import useSWR from 'swr';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/apiClient';
import { logAuditEvent } from '@/lib/auditUtils';

// Eliminado soporte de columna position

// Fetcher usando API REST (ordenando por created_at desc y luego nombre en cliente si se desea)
const fetcher = async () => {
  const resp = await apiClient.get('/analysis?limit=1000');
  return (resp?.data || []).sort((a,b)=> a.name.localeCompare(b.name));
};

export const useStudies = () => {
  const { toast } = useToast();
  const { data: studies, error, mutate } = useSWR('analysis:list', fetcher);

  const createStudy = async (studyData) => {
    try {
      const created = await apiClient.post('/analysis', studyData);
      await logAuditEvent('EstudioCreado', { analysisId: created.id, name: created.name });
      toast({ title: 'Éxito', description: 'Estudio creado correctamente.' });
      mutate();
    } catch (e) {
      console.error('Error creating analysis:', e);
      toast({ title: 'Error al crear', description: e.message || 'No se pudo crear el estudio.', variant: 'destructive' });
      throw e;
    }
  };

  const updateStudy = async (id, studyData) => {
    try {
      await apiClient.put(`/analysis/${id}`, studyData);
      await logAuditEvent('EstudioActualizado', { analysisId: id });
      toast({ title: 'Éxito', description: 'Estudio actualizado correctamente.' });
      mutate();
    } catch (e) {
      console.error('Error updating analysis:', e);
      toast({ title: 'Error al actualizar', description: e.message || 'No se pudo actualizar el estudio.', variant: 'destructive' });
      throw e;
    }
  };

  const deleteStudy = async (id) => {
    try {
      await apiClient.delete(`/analysis/${id}`);
      await logAuditEvent('EstudioEliminado', { analysisId: id });
      toast({ title: 'Éxito', description: 'Estudio eliminado correctamente.' });
      mutate();
    } catch (e) {
      console.error('Error deleting analysis:', e);
      toast({ title: 'Error al eliminar', description: e.message || 'No se pudo eliminar el estudio.', variant: 'destructive' });
      throw e;
    }
  };

  // Sincroniza los parámetros editados con la base de datos
  // Usa endpoint transactional /analysis/:id/parameters-sync
  const syncParameters = async (studyId, parameters) => {
    if (!studyId || !Array.isArray(parameters)) return;
    // Backend espera parameters con potencialmente reference_ranges (adaptar si es necesario)
    const payload = parameters.map(p => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      decimal_places: p.decimal_places,
      position: p.position,
      valorReferencia: p.valorReferencia || p.reference_ranges || []
    }));
    try {
      await apiClient.post(`/analysis/${studyId}/parameters-sync`, { parameters: payload });
      await logAuditEvent('ParametrosSincronizados', { analysisId: studyId, count: payload.length });
      mutate();
    } catch (e) {
      console.error('Error al sincronizar parámetros:', e);
      throw e;
    }
  };

  // Persistir sólo posiciones (orden) de parámetros existentes
  const persistParameterOrder = async () => { /* función vacía: ordering removido */ };

  return {
    studies: studies || [],
    isLoading: !error && !studies,
    isError: error,
    createStudy,
    updateStudy,
    deleteStudy,
  syncParameters,
  persistParameterOrder,
  };
};
