import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { logAuditEvent } from '@/lib/auditUtils';
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';

const PAGE_SIZE = 50;

const cleanReferenceValueForStorage = (value) => {
  if (value === '' || value === undefined || value === null) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

const cleanIntegerForStorage = (value) => {
  if (value === '' || value === undefined || value === null) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
};

export const initialStudyFormState = {
  id: null,
  clave: '',
  name: '',
  category: '',
  description: '',
  indications: '',
  sample_type: '',
  sample_container: '',
  processing_time_hours: '',
  general_units: '',
  parameters: [],
  particularPrice: '',
};

const studiesFetcher = async ({ page, searchTerm }) => {
  const limit = PAGE_SIZE;
  const offset = page * PAGE_SIZE;
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (searchTerm) params.set('search', searchTerm);
  // Use detailed endpoint to fetch nested parameters + ranges
  const res = await apiClient.get(`/analysis/detailed?${params.toString()}`);
  const total = res?.page?.total || 0;
  const raw = Array.isArray(res?.data) ? res.data : [];
  const formatted = raw.map(s => ({
    id: s.id,
    clave: s.clave || '',
    name: s.name || '',
    category: s.category || '',
    description: s.description || '',
    indications: s.indications || '',
    sample_type: s.sample_type || '',
    sample_container: s.sample_container || '',
    processing_time_hours: s.processing_time_hours || '',
    general_units: s.general_units || '',
    created_at: s.created_at,
    parameters: (s.parameters || []).map(p => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      decimal_places: p.decimal_places,
      position: p.position,
      valorReferencia: (p.reference_ranges || []).map(rr => ({
        id: rr.id,
        sexo: rr.sex,
        edadMin: rr.age_min,
        edadMax: rr.age_max,
        unidadEdad: rr.age_min_unit || 'años',
        valorMin: rr.lower,
        valorMax: rr.upper,
        textoPermitido: rr.text_value,
        tipoValor: rr.text_value ? (rr.text_value.length > 50 ? 'textoLibre' : 'alfanumerico') : 'numerico',
        notas: rr.notes || ''
      }))
    }))
  }));
  return { studies: formatted, count: total };
};

export const useStudies = (searchTerm) => {
  const { user } = useAuth();
  const { referrers = [], loadData } = useAppData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studiesPage, setStudiesPage] = useState(0);

  const swrKey = user ? { page: studiesPage, searchTerm } : null;
  const { data, error, mutate } = useSWR(swrKey, studiesFetcher, {
    onError: (err) =>
      toast.error('Error al cargar estudios', { description: err.message }),
  });

  const particularReferrer = referrers.find((r) => r.name === 'Particular');

  const getParticularPrice = useCallback(
    (studyId) => {
      if (particularReferrer?.listaprecios?.studies) {
        const priceEntry = particularReferrer.listaprecios.studies.find(
          (p) => p.itemId === studyId
        );
        return priceEntry?.price != null
          ? parseFloat(priceEntry.price).toFixed(2)
          : '0.00';
      }
      return '0.00';
    },
    [particularReferrer]
  );

  const generateStudyKey = useCallback(async () => {
    try {
      const data = await apiClient.get('/analysis/next-key');
      return data?.clave || '';
    } catch {
      const today = new Date();
      const datePart = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
      return `${datePart}-001`;
    }
  }, []);

  const upsertStudy = async (studyData) => {
    const { id, parameters, created_at, particularPrice, ...studyInfo } = studyData;
    const payload = {
      clave: studyInfo.clave || undefined,
      name: studyInfo.name || '',
      category: studyInfo.category || null,
      description: studyInfo.description || null,
      indications: studyInfo.indications || null,
      sample_type: studyInfo.sample_type || null,
      sample_container: studyInfo.sample_container || null,
      processing_time_hours: cleanIntegerForStorage(studyInfo.processing_time_hours),
      general_units: studyInfo.general_units || null
    };
    let saved;
    if (id) {
      saved = await apiClient.put(`/analysis/${id}`, payload);
      await logAuditEvent('EstudioActualizado', { studyId: saved.id, studyName: saved.name }, user?.id);
    } else {
      if (!payload.clave) payload.clave = await generateStudyKey();
      saved = await apiClient.post('/analysis', payload);
      await logAuditEvent('EstudioCreado', { studyId: saved.id, studyName: saved.name }, user?.id);
    }
    return saved;
  };

  // Combina valores de referencia Masculino/Femenino idénticos en una sola fila 'Ambos'
  function combineReferenceValues(refs = []) {
    const normGender = (g) => {
      if (!g) return 'Ambos';
      const t = g.toString().trim().toLowerCase();
      if (t.startsWith('m')) return 'Masculino';
      if (t.startsWith('f')) return 'Femenino';
      if (t.startsWith('a')) return 'Ambos';
      return g === 'M' ? 'Masculino' : g === 'F' ? 'Femenino' : 'Ambos';
    };
    const groups = new Map();
    refs.forEach(r => {
      const gender = normGender(r.sexo || r.gender);
      const age_min = r.age_min ?? r.edadMin ?? null;
      const age_max = r.age_max ?? r.edadMax ?? null;
      const age_unit = r.age_unit || r.unidadEdad || 'años';
      const tipoValor = r.tipoValor || (r.textoLibre ? 'textoLibre' : (r.textoPermitido ? 'alfanumerico' : 'numerico'));
      const normal_min = r.normal_min ?? r.valorMin ?? null;
      const normal_max = r.normal_max ?? r.valorMax ?? null;
      const textoPermitido = r.textoPermitido || '';
      const textoLibre = r.textoLibre || '';
      const notas = r.notas || '';
      const key = [age_min ?? '', age_max ?? '', age_unit, tipoValor, normal_min ?? '', normal_max ?? '', textoPermitido, textoLibre, notas].join('|');
      if (!groups.has(key)) groups.set(key, { sample: { age_min, age_max, age_unit, tipoValor, normal_min, normal_max, textoPermitido, textoLibre, notas }, genders: new Set(), items: [] });
      const g = groups.get(key);
      g.genders.add(gender);
      g.items.push({ gender, age_min, age_max, age_unit, tipoValor, normal_min, normal_max, textoPermitido, textoLibre, notas });
    });
    const merged = [];
    groups.forEach(g => {
      if (g.genders.has('Ambos')) {
        // Si ya hay un registro Ambos para esta combinación ignoramos otros.
        merged.push({ sexo: 'Ambos', ...g.sample });
      } else if (g.genders.has('Masculino') && g.genders.has('Femenino')) {
        merged.push({ sexo: 'Ambos', ...g.sample });
      } else {
        g.items.forEach(it => merged.push({ sexo: it.gender, ...g.sample }));
      }
    });
    return merged;
  }

  const syncParameters = async (studyId, parameters) => {
    if (!studyId) throw new Error('studyId requerido para sincronizar parámetros');
    const payload = {
      parameters: (parameters || []).map(p => ({
        id: p.id || null,
        name: (p.name || '').trim(),
        unit: (p.unit || '').trim(),
        decimal_places: cleanIntegerForStorage(p.decimal_places),
        position: typeof p.position === 'number' ? p.position : null,
        // Aplicar combinación M/F idénticos -> Ambos antes de enviar
        valorReferencia: combineReferenceValues(p.valorReferencia || []).map(vr => ({
          sexo: vr.sexo || vr.gender || 'Ambos',
          age_min: vr.age_min ?? vr.edadMin ?? null,
          age_max: vr.age_max ?? vr.edadMax ?? null,
          age_unit: vr.age_unit || vr.unidadEdad || vr.age_unit || 'años',
          tipoValor: vr.tipoValor || (vr.textoLibre ? 'textoLibre' : (vr.textoPermitido ? 'alfanumerico' : 'numerico')),
          normal_min: vr.normal_min ?? vr.valorMin ?? null,
          normal_max: vr.normal_max ?? vr.valorMax ?? null,
          textoPermitido: vr.textoPermitido || '',
          textoLibre: vr.textoLibre || '',
          notas: vr.notas || ''
        }))
      }))
    };
    const res = await apiClient.post(`/analysis/${studyId}/parameters-sync`, payload);
    return (res?.parameters || []).map(p => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      decimal_places: p.decimal_places,
      position: p.position,
      valorReferencia: (p.reference_ranges || []).map(rr => ({
        id: rr.id,
        sexo: rr.sex,
        edadMin: rr.age_min,
        edadMax: rr.age_max,
        unidadEdad: rr.age_min_unit || 'años',
        valorMin: rr.lower,
        valorMax: rr.upper,
        textoPermitido: rr.text_value,
        tipoValor: rr.text_value ? (rr.text_value.length > 50 ? 'textoLibre' : 'alfanumerico') : 'numerico',
        notas: rr.notes || ''
      }))
    }));
  };

  const syncReferenceRanges = async () => { /* ya se maneja en parameters-sync */ };

  const updateParticularPrice = async (studyId, price) => {
    if (price === undefined || !particularReferrer) return;
    try {
      // Re-fetch referrer
      const refDataArr = await apiClient.get('/referrers?limit=1&search=Particular');
      const fresh = Array.isArray(refDataArr?.data) ? refDataArr.data.find(r => r.name === 'Particular') : null;
      if (!fresh) throw new Error('Referente Particular no encontrado');
      const newPrice = cleanReferenceValueForStorage(price);
      const priceList = fresh.listaprecios || { studies: [] };
      const studies = Array.isArray(priceList.studies) ? [...priceList.studies] : [];
      const idx = studies.findIndex(p => p.itemId === studyId);
      if (idx > -1) studies[idx].price = newPrice; else studies.push({ itemId: studyId, price: newPrice });
      await apiClient.put(`/referrers/${fresh.id}`, { listaprecios: { ...priceList, studies } });
    } catch (e) {
      toast.warning('Precio Particular no actualizado', { description: e.message });
    }
  };

  const handleSubmit = useCallback(
    async (studyData) => {
      setIsSubmitting(true);
      const promise = (async () => {
        const savedStudy = await upsertStudy(studyData);
        const savedParams = await syncParameters(savedStudy.id, studyData.parameters || []);
        await syncReferenceRanges(savedParams);
        await updateParticularPrice(savedStudy.id, studyData.particularPrice);
        await mutate();
        if (typeof loadData === 'function') await loadData();
        return savedStudy;
      })();

      toast.promise(promise, {
        loading: 'Guardando estudio...',
        success: (savedStudy) => `El estudio ${savedStudy.name} se guardó con éxito.`,
        error: (e) => `Error al guardar: ${e.message}`,
      });

      try {
        await promise;
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, generateStudyKey, mutate, loadData, particularReferrer]
  );

  const handleDeleteStudy = useCallback(
    async (studyToDelete) => {
      if (!studyToDelete) return false;

      const run = async () => {
  // Delete study (cascades or FK constraints should handle children)
  await apiClient.delete(`/analysis/${studyToDelete.id}`);

        await logAuditEvent('EstudioEliminado', { studyId: studyToDelete.id, studyName: studyToDelete.name }, user?.id);
        await mutate();
        if (typeof loadData === 'function') await loadData();

        return studyToDelete;
      };

      const promise = run();

      toast.promise(promise, {
        loading: 'Eliminando estudio...',
        success: (deleted) => `El estudio ${deleted.name} ha sido eliminado.`,
        error: (e) => `Error al eliminar: ${e.message}`,
      });

      try {
        await promise;
        return true;
      } catch {
        return false;
      }
    },
    [user, mutate, loadData]
  );

  const updateStudyPrices = useCallback(async (studyId, referrerId, newPrice) => {
    try {
      const price = cleanReferenceValueForStorage(newPrice);
      const ref = await apiClient.get(`/referrers/${referrerId}`);
      const current = ref?.listaprecios || { studies: [] };
      const studiesArr = Array.isArray(current.studies) ? [...current.studies] : [];
      const i = studiesArr.findIndex(x => x.itemId === studyId);
      if (i > -1) studiesArr[i] = { ...studiesArr[i], price }; else studiesArr.push({ itemId: studyId, price });
      await apiClient.put(`/referrers/${referrerId}`, { listaprecios: { ...current, studies: studiesArr } });
      if (typeof loadData === 'function') await loadData();
      toast.success('Precio actualizado');
      return true;
    } catch (e) {
      toast.error('No se pudo actualizar el precio', { description: e.message });
      return false;
    }
  }, [loadData]);

  return {
    studies: data?.studies || [],
    studiesCount: data?.count || 0,
    loadingStudies: !data && !error,
    isSubmitting,
    getParticularPrice,
    handleSubmit,
    persistParameterOrder: async (studyId, orderedParams) => {
      if (!studyId) return;
      const paramsWithPositions = (orderedParams || []).map((p, idx) => ({ ...p, position: typeof p.position === 'number' ? p.position : idx }));
      try {
        await syncParameters(studyId, paramsWithPositions);
        await mutate();
        toast.success('Orden de parámetros guardado');
      } catch (e) { toast.error('No se pudo guardar el orden', { description: e.message }); }
    },
    handleImmediateParameterSave: async (studyId, parameterPayload) => {
      if (!studyId) { toast.error('Falta ID del estudio'); return null; }
      try {
        setIsSubmitting(true);
        // Obtener estado actual (refetch) y luego aplicar merge mínimo
        const current = await studiesFetcher({ page: 0, searchTerm: '' }); // simple fetch first page (optimización pendiente)
        const target = current.studies.find(s => s.id === studyId);
        const existingParams = target?.parameters || [];
        let updatedList;
        if (parameterPayload.id) {
          updatedList = existingParams.map(p => p.id === parameterPayload.id ? { ...p, ...parameterPayload } : p);
        } else {
          updatedList = [...existingParams, { ...parameterPayload, id: null }];
        }
        await syncParameters(studyId, updatedList);
        await mutate();
        toast.success('Parámetro guardado');
        return true;
      } catch (e) { toast.error('Error al guardar parámetro', { description: e.message }); return null; }
      finally { setIsSubmitting(false); }
    },
    handleImmediateParameterDelete: async (studyId, parameterId) => {
      if (!studyId || !parameterId) return false;
      try {
        setIsSubmitting(true);
        const current = await studiesFetcher({ page: 0, searchTerm: '' });
        const target = current.studies.find(s => s.id === studyId);
        const updated = (target?.parameters || []).filter(p => p.id !== parameterId);
        await syncParameters(studyId, updated);
        await mutate();
        toast.success('Parámetro eliminado');
        return true;
      } catch (e) { toast.error('No se pudo eliminar', { description: e.message }); return false; }
      finally { setIsSubmitting(false); }
    },
    handleDeleteStudy,
    loadStudies: mutate,
    updateStudyPrices,
    studiesPage,
    setStudiesPage,
    PAGE_SIZE,
    totalStudiesPages: data?.count ? Math.ceil(data.count / PAGE_SIZE) : 0,
  };
};