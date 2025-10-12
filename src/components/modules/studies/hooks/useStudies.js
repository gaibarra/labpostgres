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
  params.set('sort', 'param_count_desc');
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
        // Inferencia: si hay límites numéricos -> numérico; si hay texto -> alfanumérico/textoLibre; si nada -> textoLibre
        tipoValor: (rr.lower != null || rr.upper != null)
          ? 'numerico'
          : (rr.text_value ? (rr.text_value.length > 50 ? 'textoLibre' : 'alfanumerico') : 'textoLibre'),
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

  const upsertStudy = useCallback(async (studyInfo) => {
    if (!studyInfo) throw new Error('studyInfo requerido');
    const id = studyInfo.id || null;
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
  }, [generateStudyKey, user]);

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

  const syncParameters = useCallback(async (studyId, parameters) => {
    if (!studyId) throw new Error('studyId requerido para sincronizar parámetros');
    // Prevalidación cliente antes de enviar
    const allowedAgeUnits = new Set(['años','year','years','meses','months','dias','días','days']);
    function canonicalAgeUnit(u){
      if (!u) return 'años';
      const v = u.toString().trim().toLowerCase();
      if (['a','ano','años','year','years'].includes(v)) return 'años';
      if (['m','mes','meses','month','months'].includes(v)) return 'meses';
      if (['d','dia','día','dias','días','day','days'].includes(v)) return 'días';
      return 'años';
    }
    function canonicalSex(s){
      if (!s) return 'ambos';
      const v = s.toString().trim().toLowerCase();
      if (v.startsWith('m')) return 'masculino';
      if (v.startsWith('f')) return 'femenino';
      if (v.startsWith('a')) return 'ambos';
      return 'ambos';
    }
    const clientErrors = [];
    const cleanedParameters = (parameters || []).map((p,pIndex)=>{
      const originalCombined = combineReferenceValues(p.valorReferencia || []);
      const beforeCount = originalCombined.length;
      // Detect canonical placeholder segmentation (6 segments 0-1,1-2,2-12,12-18,18-65,65-120 all Ambos, null values, placeholder note)
      const CANON_SEGS = [[0,1],[1,2],[2,12],[12,18],[18,65],[65,120]];
      const isCanonicalPlaceholderSet = beforeCount === CANON_SEGS.length && originalCombined.every(seg => {
        return seg.sexo === 'Ambos'
          && CANON_SEGS.some(([a,b]) => a === (seg.age_min ?? seg.edadMin) && b === (seg.age_max ?? seg.edadMax))
          && (seg.normal_min ?? seg.valorMin ?? null) == null
          && (seg.normal_max ?? seg.valorMax ?? null) == null
          && /sin referencia establecida/i.test(seg.notas || '');
      });
      const valorReferencia = originalCombined
        // Nuevo criterio: sólo descartar si absolutamente TODOS (lower/upper/textos) están vacíos y la nota es placeholder.
        .filter(vr => {
          if (isCanonicalPlaceholderSet) return true; // preservamos los 6 segmentos canónicos vacíos
          const hasNumeric = vr.normal_min != null || vr.normal_max != null;
          const hasText = (vr.textoLibre && vr.textoLibre.trim()) || (vr.textoPermitido && vr.textoPermitido.trim());
          const isPlaceholderNote = vr.notas && /sin referencia establecida/i.test(vr.notas);
          if (!hasNumeric && !hasText && isPlaceholderNote) return false; // descartar verdadero placeholder (no canónico)
          return true; // conservar incluso rangos abiertos (solo lower o solo upper)
        })
        .map((vr,rIndex)=>{
        const age_unit_raw = vr.age_unit || vr.unidadEdad || 'años';
        const age_unit = canonicalAgeUnit(age_unit_raw);
        const normal_min = vr.normal_min ?? vr.valorMin ?? null;
        const normal_max = vr.normal_max ?? vr.valorMax ?? null;
        if (normal_min != null && normal_max != null && Number(normal_min) > Number(normal_max)) {
          clientErrors.push({ type:'INVALID_INTERVAL', paramIndex:pIndex, rangeIndex:rIndex, lower:normal_min, upper:normal_max });
        }
        if (!allowedAgeUnits.has(age_unit)) {
          clientErrors.push({ type:'INVALID_AGE_UNIT', paramIndex:pIndex, rangeIndex:rIndex, unit:age_unit_raw });
        }
        return {
          sex: canonicalSex(vr.sexo || vr.gender || vr.sex),
          age_min: vr.age_min ?? vr.edadMin ?? null,
          age_max: vr.age_max ?? vr.edadMax ?? null,
          age_min_unit: age_unit,
          tipoValor: vr.tipoValor || (vr.textoLibre ? 'textoLibre' : (vr.textoPermitido ? 'alfanumerico' : 'numerico')),
          normal_min,
          normal_max,
          // Aliases para compatibilidad backend (persistencia de límites IA)
          valorMin: normal_min,
          valorMax: normal_max,
          lower: normal_min,
          upper: normal_max,
          textoPermitido: vr.textoPermitido || '',
          textoLibre: vr.textoLibre || '',
          notas: vr.notas || ''
        };
      });
      if (process.env.NODE_ENV !== 'production') {
        try {
          // eslint-disable-next-line no-console
          console.debug('[useStudies][syncParameters] paramIndex=%d name="%s" ranges before=%d after=%d', pIndex, p.name, beforeCount, valorReferencia.length);
        } catch(_) { /* noop */ }
      }
      // Si todos los rangos originales eran placeholders (beforeCount>0) y tras el filtrado quedó vacío, agregamos
      // un placeholder sintético neutro para que el backend (parameters-sync) active su fallback e inserte
      // un rango visible en DB. Sin esto, rawRanges=[] provoca preservación (sin rangos) y el usuario percibe
      // que el parámetro "no se guardó" (especialmente en flujo Parámetro IA con sólo placeholders).
      if (valorReferencia.length === 0 && beforeCount > 0) {
        // Si era el set canónico, mantenemos los 6 segmentos (no debería ocurrir porque los preservamos arriba)
        if (isCanonicalPlaceholderSet) {
          CANON_SEGS.forEach(([a,b])=>{
            valorReferencia.push({
              sexo: 'Ambos',
              edadMin: a,
              edadMax: b,
              unidadEdad: 'años',
              valorMin: null,
              valorMax: null,
              lower: null,
              upper: null,
              notas: 'Sin referencia establecida'
            });
          });
        } else {
          valorReferencia.push({
            sexo: 'Ambos',
            edadMin: null,
            edadMax: null,
            unidadEdad: 'años',
            valorMin: null,
            valorMax: null,
            lower: null,
            upper: null,
            notas: 'Sin referencia establecida'
          });
        }
        if (process.env.NODE_ENV !== 'production') {
          try { console.debug('[useStudies][syncParameters] inserted synthetic placeholder to trigger backend fallback paramIndex=%d', pIndex); } catch(_) { /* noop */ }
        }
      }
      return {
        id: p.id || null,
        name: (p.name || '').trim(),
        unit: (p.unit || '').trim(),
        decimal_places: cleanIntegerForStorage(p.decimal_places),
        position: typeof p.position === 'number' ? p.position : null,
        valorReferencia
      };
    });
    if (clientErrors.length){
      const first = clientErrors[0];
      let msg;
      switch(first.type){
        case 'INVALID_INTERVAL': msg = `Rango inválido (lower>upper) en parámetro ${first.paramIndex+1}, rango ${first.rangeIndex+1}`; break;
        case 'INVALID_AGE_UNIT': msg = `Unidad de edad inválida en parámetro ${first.paramIndex+1}, rango ${first.rangeIndex+1}`; break;
        default: msg = 'Error de validación en rangos';
      }
      toast.error(msg);
      const error = new Error(msg);
      error.code = 'CLIENT_RANGE_VALIDATION_FAIL';
      error.details = first;
      throw error;
    }
    const payload = { parameters: cleanedParameters };
    if (process.env.NODE_ENV !== 'production') {
      try {
        const sample = cleanedParameters?.[0]?.valorReferencia?.[0];
        // eslint-disable-next-line no-console
        console.debug('[useStudies][parameters-sync] sample first range payload', sample);
  } catch (e) { /* noop debug sample */ }
    }
    let res;
    try {
      res = await apiClient.post(`/analysis/${studyId}/parameters-sync`, payload);
    } catch(e){
      const code = e?.details?.code || e?.code;
      if (code === 'REFERENCE_RANGE_CONSTRAINT_FAIL') {
        const det = e?.details || {};
        const idxInfo = typeof det.rangeIndex === 'number' ? ` (parámetro ${ (det.paramIndex??0)+1 }, rango ${(det.rangeIndex??0)+1})` : '';
        toast.error('Rango inválido (constraint)', { description: `${det.constraint || ''}${idxInfo}`.trim() });
      }
      if (code === 'DUPLICATE_REFERENCE_RANGE') {
        const det = e?.details || {};
        const idxInfo = typeof det.rangeIndex === 'number' ? `Parámetro ${ (det.paramIndex??0)+1 }, rango ${(det.rangeIndex??0)+1}` : '';
        toast.error('Rango duplicado', { description: idxInfo });
      }
      throw e;
    }
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
        tipoValor: (rr.lower != null || rr.upper != null)
          ? 'numerico'
          : (rr.text_value ? (rr.text_value.length > 50 ? 'textoLibre' : 'alfanumerico') : 'textoLibre'),
        notas: rr.notes || ''
      }))
    }));
  }, []);

  const syncReferenceRanges = async () => { /* ya se maneja en parameters-sync */ };

  const updateParticularPrice = useCallback(async (studyId, price) => {
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
  }, [particularReferrer]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Dependencias reducidas: funciones estables por definición en este hook
    [upsertStudy, syncParameters, updateParticularPrice, mutate, loadData]
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