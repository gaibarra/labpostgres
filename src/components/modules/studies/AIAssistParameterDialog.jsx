import React, { useState, useRef, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles, RotateCcw, AlertCircle } from 'lucide-react';

/**
 * Dialogo para generar un único parámetro vía IA (mock determinista o proveedor real).
 * Props:
 *  - isOpen, onOpenChange
 *  - studyId, studyName, existingParameters (string[])
 *  - onAccept(parameter)
 */
export default function AIAssistParameterDialog({ isOpen, onOpenChange, studyId, studyName, existingParameters = [], onAccept, autoSuggestOnOpen = false }) {
  // NUEVA UX: solo captura nombre con opción de sugerencia IA (una sola a la vez)
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestMeta, setSuggestMeta] = useState(null); // guarda respuesta completa si backend trae más que nombre
  const abortRef = useRef(null);
  // Barra de progreso y polling similar a AIAssistDialog
  const TOTAL_TIMEOUT_MS = 300000; // 5 min
  const MIN_PROGRESS = 5;
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const progressTimerRef = useRef(null);
  const pollAbortRef = useRef(null);
  // Bandera para no disparar múltiples veces la auto-sugerencia
  const autoTriggeredRef = useRef(false);

  const lowerExisting = (existingParameters || []).map(p => (typeof p === 'string' ? p : p?.name || '')).filter(Boolean).map(s=>s.toLowerCase());
  const duplicate = name.trim() !== '' && lowerExisting.includes(name.trim().toLowerCase());
  const canAccept = name.trim().length >= 2 && !duplicate && !loading;
  const canSuggest = !!studyName && name.trim().length >= 2 && !duplicate && !loading; // studyId ya no es obligatorio para generar rangos

  // Definimos primero pollJob y handleSuggest para evitar TDZ en efectos posteriores
  const pollJob = useCallback((jobId, startedAt)=>{
    const ac = new AbortController();
    pollAbortRef.current = ac;
    startProgressTimer(startedAt);
    const pollInterval = 1500;
    const tick = async () => {
      if (ac.signal.aborted) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > TOTAL_TIMEOUT_MS) {
        ac.abort();
        setLoading(false);
        setError('Tiempo excedido (>5 min).');
        if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
        return;
      }
      try {
        const data = await apiClient.get(`/ai/generate-parameter/job/${jobId}`, { signal: ac.signal });
          const serverPct = parseInt(data.progress || 0, 10);
          setProgress(prev => Math.max(prev, MIN_PROGRESS, isNaN(serverPct)?MIN_PROGRESS:serverPct));
          setProgressMsg(data.message || '');
          if (data.status === 'done' && data.parameter) {
            const p = data.parameter;
            // Aceptar formato valorReferencia o reference_ranges
            const rr = p.reference_ranges || p.valorReferencia || p.valor_referencia;
            p.reference_ranges = normalizeReferenceRanges(rr);
            setSuggestMeta(p);
            // No sobreescribimos el nombre ingresado
            setProgress(100);
            setLoading(false);
            if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
            return;
          } else if (data.status === 'error') {
            setError(data.error?.message || 'Error en job IA');
            setLoading(false);
            if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
            return;
          }
      } catch(e){ /* silencio */ }
      setTimeout(tick, pollInterval);
    };
    setTimeout(tick, pollInterval);
  }, [MIN_PROGRESS]);

  // Construye un prompt rico con contexto de estudio y parámetros existentes
  function buildParameterPrompt({ studyName, desiredName, existingParameters }) {
    const trimmedName = (desiredName||'').trim();
    const existingList = (existingParameters||[]).map(p=> typeof p === 'string' ? p : p?.name).filter(Boolean);
    const header = `Actúa como bioquímico clínico senior. Genera un NUEVO parámetro propuesto que complemente el estudio "${studyName}".`;
    const objetivo = trimmedName ? `Nombre sugerido por el usuario: "${trimmedName}". Usa ese nombre solo como inspiración, no inventes diagnósticos.` : 'El usuario no proporcionó nombre sugerido.';
    const existentes = existingList.length ? `Parámetros ya existentes en el estudio (no los repitas): ${existingList.join(', ')}.` : 'No hay parámetros existentes.';
    const formato = `Devuelve SOLO JSON válido con forma: { "parameter": { "name": "string", "unit": "string", "decimal_places": number, "reference_ranges": [ { "sex": "Ambos|Masculino|Femenino", "age_min": number|null, "age_max": number|null, "age_min_unit": "años", "lower": number|null, "upper": number|null, "text_value": string|null, "notes": string } ] } }`;
    const reglas = `Reglas: 1) Cubre población 0-120 años con uno o más segmentos. 2) Si no hay valores establecidos deja lower y upper en null y notes='Sin referencia establecida'. 3) Evita afirmaciones regulatorias. 4) No repitas parámetros existentes. 5) Mantén decimal_places entre 0 y 3.`;
    return [header, objetivo, existentes, reglas, formato, 'NO agregues texto fuera del JSON.'].join('\n');
  }

  const handleSuggest = useCallback(async () => {
    if (!canSuggest) return;
    setLoading(true); setError(null);
    setSuggestMeta(null);
    setProgress(MIN_PROGRESS); setProgressMsg('Creando job...');
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Generamos prompt local e incluimos en la petición para que el backend (si lo soporta en el futuro) pueda usarlo
      const richPrompt = buildParameterPrompt({ studyName, desiredName: name, existingParameters });
      const data = await apiClient.post('/ai/generate-parameter/async', { studyName, desiredParameterName: name, existingParameters, prompt: richPrompt }, { signal: controller.signal });
      if (data?.jobId) {
        setProgress(prev => Math.max(prev+2, MIN_PROGRESS+2));
        setProgressMsg('En cola');
        pollJob(data.jobId, Date.now());
        return;
      } else if (data?.parameter) {
        const p = data.parameter;
        p.unit = p.unit || p.unidad || p.units || p.general_unit || p.medida || '';
        const rr = p.reference_ranges || p.valorReferencia || p.valor_referencia || p.reference_values || p.rangos || [];
        p.reference_ranges = normalizeReferenceRanges(rr);
        setSuggestMeta(p);
        setProgress(100);
      } else {
        setError('Respuesta IA sin datos de rangos.');
      }
    } catch(e){
      if (e.name !== 'AbortError') {
        const statusPart = e?.status ? `HTTP ${e.status} - ` : '';
        setError(`${statusPart}${e?.message || 'Fallo en generación'}`);
      }
    } finally {
      if (!pollAbortRef.current) setLoading(false);
    }
  }, [canSuggest, studyName, name, existingParameters, MIN_PROGRESS, pollJob]);

  // Ref estable a la función (asignada tras definición para evitar TDZ)
  const handleSuggestRef = useRef(null);
  useEffect(()=> { handleSuggestRef.current = handleSuggest; }, [handleSuggest]);

  // Reset + auto-disparo al abrir (usa ref para evitar dependencia directa que provoque re-ejecuciones innecesarias)
  useEffect(()=>{
    if (!isOpen) {
      setName('');
      setError(null);
      setSuggestMeta(null);
      autoTriggeredRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (pollAbortRef.current) { try { pollAbortRef.current.abort(); } catch (e) { /* ignore */ } }
      if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
      setProgress(0); setProgressMsg('');
      return;
    }
    // Se desactiva autogeneración al abrir: el usuario debe introducir nombre y luego generar rangos.
  }, [isOpen, autoSuggestOnOpen, studyId, studyName]);

  useEffect(()=>() => {
    if (pollAbortRef.current) { try { pollAbortRef.current.abort(); } catch(e){ /* ignore */ } }
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); }
  },[]);

  function normalizeReferenceRanges(rawRanges = []) {
    // Convierte un array de rangos del backend a formato homogeneo
    const norm = (rawRanges || []).map(r => ({
      sex: r.sex || r.sexo || 'Ambos',
      age_min: r.age_min ?? r.edadMin ?? null,
      age_max: r.age_max ?? r.edadMax ?? null,
      age_min_unit: r.age_min_unit || r.unidadEdad || 'años',
      lower: r.lower ?? r.valorMin ?? null,
      upper: r.upper ?? r.valorMax ?? null,
      text_value: r.text_value || r.textoLibre || r.textoPermitido || null,
      notes: r.notes || r.notas || ''
    }));
    // Si no hay nada o la cobertura es insuficiente generamos placeholders estándar por etapas de vida
    if (!norm.length) {
      const segments = [
        { min:0, max:1, label:'Neonato/Lactante (0-1a)' },
        { min:1, max:2, label:'Lactante Mayor (1-2a)' },
        { min:2, max:12, label:'Niñez (2-12a)' },
        { min:12, max:18, label:'Adolescencia (12-18a)' },
        { min:18, max:65, label:'Adulto (18-65a)' },
        { min:65, max:120, label:'Adulto Mayor (65-120a)' }
      ];
      segments.forEach(s=>{
        norm.push({ sex:'Ambos', age_min:s.min, age_max:s.max, age_min_unit:'años', lower:null, upper:null, text_value:null, notes:`(Placeholder ${s.label})` });
      });
    }
    // Bandera opcional para preservar segmentos sin fusionar.
    // Si VITE_AI_PARAM_PRESERVE === '1', devolvemos los rangos tal cual (más placeholders si se generaron arriba).
    const preserve = import.meta?.env?.VITE_AI_PARAM_PRESERVE === '1';
    if (preserve) return norm;
    // Consolidación (lógica extraída a función auxiliar para reutilización y tests en caso futuro)
    function consolidate(list) {
      const bySex = {};
      list.forEach(r=>{ (bySex[r.sex] = bySex[r.sex] || []).push(r); });
      const consolidated = [];
      Object.values(bySex).forEach(arr => {
        arr.sort((a,b)=> (a.age_min??-Infinity) - (b.age_min??-Infinity));
        let current = null;
        arr.forEach(r => {
          if (!current) { current = { ...r }; return; }
          const compatible = (current.text_value || '') === (r.text_value || '') && (current.lower??null) === (r.lower??null) && (current.upper??null) === (r.upper??null) && (current.notes||'') === (r.notes||'');
          const currentEnd = current.age_max;
          const rStart = r.age_min;
          if (compatible && (currentEnd == null || rStart == null || currentEnd >= rStart)) {
            current.age_max = (r.age_max == null ? current.age_max : (current.age_max == null ? r.age_max : Math.max(current.age_max, r.age_max)));
            current.age_min = (current.age_min == null ? r.age_min : current.age_min);
          } else {
            consolidated.push(current); current = { ...r };
          }
        });
        if (current) consolidated.push(current);
      });
      return consolidated;
    }
    return consolidate(norm);
  }

  function startProgressTimer(startedAt) {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(()=>{
      const elapsed = Date.now() - startedAt;
      let phasePct;
      if (elapsed < 4000) {
        phasePct = 5 + (elapsed/4000)*20; // 5->25
      } else if (elapsed < 15000) {
        phasePct = 25 + ((elapsed-4000)/(11000))*30; // 25->55
      } else if (elapsed < 60000) {
        phasePct = 55 + ((elapsed-15000)/(45000))*20; // 55->75
      } else if (elapsed < TOTAL_TIMEOUT_MS*0.75) {
        const span = (TOTAL_TIMEOUT_MS*0.75) - 60000;
        phasePct = 75 + ((elapsed-60000)/span)*15; // 75->90
      } else {
        const span = TOTAL_TIMEOUT_MS - (TOTAL_TIMEOUT_MS*0.75);
        phasePct = 90 + ((elapsed-(TOTAL_TIMEOUT_MS*0.75))/span)*7; // 90->97
      }
      const capped = Math.min(97, Math.floor(phasePct));
      setProgress(prev => prev < capped ? capped : prev);
    },600);
  }

  // (Las implementaciones anteriores de pollJob y handleSuggest se reordenaron arriba)

  function toValorReferencia(ranges = []) {
    const segmentsFallback = [ [0,1], [1,2], [2,12], [12,18], [18,65], [65,120] ];
    const normSex = (s)=>{
      if(!s) return 'Ambos';
      const t = s.toString().trim().toLowerCase();
      if (t.startsWith('m')) return 'Masculino';
      if (t.startsWith('f')) return 'Femenino';
      if (t.startsWith('a')) return 'Ambos';
      return 'Ambos';
    };
    const preserve = import.meta?.env?.VITE_AI_PARAM_PRESERVE === '1';
    const mapped = (ranges||[])
      .filter(r=> r && (r.sex||r.sexo||r.lower!=null||r.upper!=null||r.text_value||r.textoPermitido||r.textoLibre))
      .map(r=>({
        sexo: normSex(r.sex || r.sexo),
        edadMin: r.age_min ?? r.edadMin ?? r.min ?? null,
        edadMax: r.age_max ?? r.edadMax ?? r.max ?? null,
        unidadEdad: r.age_min_unit || r.age_unit || r.unidadEdad || 'años',
        valorMin: r.lower ?? r.valorMin ?? r.min_value ?? null,
        valorMax: r.upper ?? r.valorMax ?? r.max_value ?? null,
        textoPermitido: r.text_value || r.textoPermitido || null,
        textoLibre: r.textoLibre || null,
        notas: r.notes || r.notas || ''
      }));
    // Caso especial: un único rango general (Ambos, edades nulas) con valores -> preservar como 0-120
    if (!preserve) {
      if (mapped.length === 1 && mapped[0].sexo === 'Ambos' && mapped[0].edadMin == null && mapped[0].edadMax == null && (mapped[0].valorMin != null || mapped[0].valorMax != null)) {
        return [{ ...mapped[0], edadMin: 0, edadMax: 120 }];
      }
    }
    // Si quedó vacío -> placeholders estándar Ambos
    if (!mapped.length) {
      return segmentsFallback.map(([a,b])=>({ sexo:'Ambos', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }));
    }
    // Validar cobertura 0-120 por sexo presente; si hay sólo 'Ambos' y algún rango tiene edadMin/Max nulos, segmentar fallback completo.
    const sexes = Array.from(new Set(mapped.map(r=>r.sexo || 'Ambos')));
    function expandIfNeeded(list, sexo){
      // Ordenar y rellenar huecos sólo si los rangos tienen edades (o son todos null -> segmentar)
      const allNullAges = list.every(r=> r.edadMin==null && r.edadMax==null);
      if (allNullAges) {
        // Si existe al menos un valor numérico en el conjunto, preservar uno solo 0-120 con esos valores
        const withValues = list.find(r => r.valorMin != null || r.valorMax != null);
        if (withValues) {
          return [{ ...withValues, edadMin: 0, edadMax: 120 }];
        }
        return segmentsFallback.map(([a,b])=>({ sexo, edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }));
      }
      const filtered = list.map(r=>({ ...r, edadMin: r.edadMin==null?0:r.edadMin, edadMax: r.edadMax==null?120:r.edadMax })).sort((a,b)=> a.edadMin - b.edadMin);
      const out=[]; let cursor=0;
      for (const r of filtered){
        if (r.edadMin>cursor) {
          out.push({ sexo, edadMin:cursor, edadMax:r.edadMin-1, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
        }
        out.push(r);
        cursor = Math.max(cursor, r.edadMax+1);
        if (cursor>120) break;
      }
      if (cursor<=120) out.push({ sexo, edadMin:cursor, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
      return out;
    }
    // Si sólo hay Ambos, procesar directo
    if (sexes.length===1 && sexes[0]==='Ambos') {
      return expandIfNeeded(mapped,'Ambos');
    }
    // Convivencia Ambos + sexos: conservar segmentos Ambos que NO alcancen el inicio de diferenciación (primer edadMin donde aparece M/F)
    const maleSegs = mapped.filter(r=>r.sexo==='Masculino');
    const femaleSegs = mapped.filter(r=>r.sexo==='Femenino');
    const unisexSegs = mapped.filter(r=>r.sexo==='Ambos');
    const minSexStart = Math.min(
      ...[...maleSegs, ...femaleSegs].map(r=> r.edadMin==null?0:r.edadMin).filter(n=> Number.isFinite(n)),
      Infinity
    );
    const preservedUnisex = unisexSegs.filter(r=> (r.edadMax??120) < (isFinite(minSexStart)? minSexStart : 9999));
    const bySex = { Masculino: maleSegs, Femenino: femaleSegs };
    const outFinal = [];
    if (bySex.Masculino.length) outFinal.push(...expandIfNeeded(bySex.Masculino,'Masculino'));
    if (bySex.Femenino.length) outFinal.push(...expandIfNeeded(bySex.Femenino,'Femenino'));
    // Añadir unisex preservados al inicio (ordenar luego)
    const merged = [...preservedUnisex, ...outFinal];
    return merged.sort((a,b)=> a.edadMin - b.edadMin || a.edadMax - b.edadMax || a.sexo.localeCompare(b.sexo));
  }

  const handleAccept = () => {
    if (!canAccept) return;
    let param;
    if (suggestMeta) {
      // Convertimos cualquier variante a valorReferencia backend-friendly
      const baseRanges = suggestMeta.reference_ranges || suggestMeta.valorReferencia || suggestMeta.valor_referencia || [];
      const valorReferencia = toValorReferencia(baseRanges);
      param = {
        name: name.trim(),
        unit: (suggestMeta.unit || '').trim(),
        decimal_places: typeof suggestMeta.decimal_places === 'number' ? suggestMeta.decimal_places : (suggestMeta.dec || 0),
        position: suggestMeta.position || null,
        valorReferencia
      };
    } else {
      param = { name: name.trim(), unit: '', decimal_places: 0, position: null, valorReferencia: toValorReferencia([]) };
    }
    // Si no trae posición, marcamos -1 para que el caller pueda reasignar después secuencialmente
    if (param.position == null) param.position = -1;
    if (import.meta?.env?.VITE_AI_PARAM_DEBUG === 'on') {
      // eslint-disable-next-line no-console
      console.debug('[AIAssistParameterDialog][accept] payload', JSON.parse(JSON.stringify(param)));
    }
    onAccept && onAccept(param);
    onOpenChange(false);
  };

  const handleReset = () => {
    setName('');
    setError(null);
    setSuggestMeta(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Parámetro IA</DialogTitle>
          <DialogDescription>Genera un nuevo parámetro basado en una breve descripción o necesidad clínica.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Estudio</label>
            <Input value={studyName || ''} disabled readOnly className="text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Nombre del parámetro (lo defines tú)</label>
            <Input value={name} onChange={e=>{ setName(e.target.value); if(error && !duplicate) setError(null); }} placeholder="Ej: Índice inflamatorio tiroideo" autoFocus disabled={loading} />
            {duplicate && <p className="text-[11px] text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Ya existe un parámetro con ese nombre.</p>}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              type="button"
              size="sm"
              onClick={handleSuggest}
              disabled={!canSuggest}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="ai-generate-ranges-btn"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} {loading ? 'Generando rangos...' : 'Generar rangos'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleReset} disabled={loading && !name}>
              <RotateCcw className="mr-2 h-4 w-4" /> Limpiar
            </Button>
            <div className="ml-auto" />
            <Button type="button" size="sm" onClick={handleAccept} disabled={!canAccept} className="bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-700 text-white">Aceptar</Button>
          </div>
          {loading && (
            <div className="w-full space-y-1 text-[11px]">
              <div className="flex justify-between"><span>Generando...</span><span>{progress}%</span></div>
              <div className="h-2 w-full bg-neutral-800 rounded overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500" style={{ width: `${Math.min(progress,100)}%` }} />
              </div>
              {progressMsg && <div className="italic opacity-75">{progressMsg}</div>}
              <div className="flex justify-end">
                <Button type="button" size="xs" variant="destructive" onClick={()=>{ if (pollAbortRef.current) pollAbortRef.current.abort(); if (abortRef.current) abortRef.current.abort(); if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current=null; } setLoading(false); setProgress(0); setProgressMsg(''); setError('Cancelado por el usuario'); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          {suggestMeta && (
            <div className="border rounded-md p-3 bg-slate-50 dark:bg-slate-800/40 space-y-2">
              <p className="text-xs font-semibold opacity-70">Sugerencia IA</p>
              {suggestMeta.reference_ranges?.some(r=>r.source==='catalog') && (
                <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white">Catálogo</span>
              )}
              {suggestMeta.name && <p className="text-sm"><span className="font-medium">(IA propuso nombre, ignorado)</span> {suggestMeta.name}</p>}
              {(suggestMeta.unit || (suggestMeta.reference_ranges && suggestMeta.reference_ranges.length)) && (
                <>
                  <p className="text-sm"><span className="font-medium">Unidad:</span> {suggestMeta.unit || '—'}</p>
                  {suggestMeta.reference_ranges?.length > 0 && (
                    <div>
                      <p className="text-sm"><span className="font-medium">Rangos sugeridos:</span></p>
                      <ScrollArea className="max-h-40 pr-2">
                        <ul className="text-[11px] space-y-1">
                          {suggestMeta.reference_ranges.map((r,i)=>(
                            <li key={i}>({r.sex}{r.age_min!=null||r.age_max!=null?`, ${r.age_min??''}-${r.age_max??''} ${r.age_min_unit||''}`:''}): {r.lower!=null?`${r.lower}`:''}{r.lower!=null||r.upper!=null?' - ':''}{r.upper!=null?`${r.upper}`:''}{r.text_value?` ${r.text_value}`:''}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                      <p className="mt-1 text-[10px] opacity-60">Mostrando {suggestMeta.reference_ranges.length} rango(s)</p>
                    </div>
                  )}
                </>
              )}
              {suggestMeta.reference_ranges && suggestMeta.reference_ranges.length>0 && (
                (()=>{
                  const rr = suggestMeta.reference_ranges;
                  const nonNull = rr.filter(r=> r.lower!=null || r.upper!=null);
                  if (nonNull.length === 0) {
                    return <p className="text-[11px] text-amber-600">Advertencia: Solo se generaron placeholders sin valores numéricos. Puedes aceptar para guardar la estructura y editar luego.</p>;
                  }
                  return null;
                })()
              )}
              {suggestMeta.notes && <p className="text-[11px] italic opacity-75">{suggestMeta.notes}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Función exportable para pruebas (mover fuera del componente para que el export sea válido)
export function toValorReferencia(ranges = []) {
  const segmentsFallback = [ [0,1], [1,2], [2,12], [12,18], [18,65], [65,120] ];
  const normSex = (s)=>{
    if(!s) return 'Ambos';
    const t = s.toString().trim().toLowerCase();
    if (t.startsWith('m')) return 'Masculino';
    if (t.startsWith('f')) return 'Femenino';
    if (t.startsWith('a')) return 'Ambos';
    return 'Ambos';
  };
  const preserve = import.meta?.env?.VITE_AI_PARAM_PRESERVE === '1';
  const mapped = (ranges||[])
    .filter(r=> r && (r.sex||r.sexo||r.lower!=null||r.upper!=null||r.text_value||r.textoPermitido||r.textoLibre))
    .map(r=>({
      sexo: normSex(r.sex || r.sexo),
      edadMin: r.age_min ?? r.edadMin ?? r.min ?? null,
      edadMax: r.age_max ?? r.edadMax ?? r.max ?? null,
      unidadEdad: r.age_min_unit || r.age_unit || r.unidadEdad || 'años',
      valorMin: r.lower ?? r.valorMin ?? r.min_value ?? null,
      valorMax: r.upper ?? r.valorMax ?? r.max_value ?? null,
      textoPermitido: r.text_value || r.textoPermitido || null,
      textoLibre: r.textoLibre || null,
      notas: r.notes || r.notas || ''
    }));
  // Caso especial: un único rango general (Ambos, edades nulas) con valores -> preservar como 0-120
  if (!preserve) {
    if (mapped.length === 1 && mapped[0].sexo === 'Ambos' && mapped[0].edadMin == null && mapped[0].edadMax == null && (mapped[0].valorMin != null || mapped[0].valorMax != null)) {
      return [{ ...mapped[0], edadMin: 0, edadMax: 120 }];
    }
  }
  // Si quedó vacío -> placeholders estándar Ambos
  if (!mapped.length) {
    return segmentsFallback.map(([a,b])=>({ sexo:'Ambos', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }));
  }
  // Validar cobertura 0-120 por sexo presente; si hay sólo 'Ambos' y algún rango tiene edadMin/Max nulos, segmentar fallback completo.
  const sexes = Array.from(new Set(mapped.map(r=>r.sexo || 'Ambos')));
  function expandIfNeeded(list, sexo){
    // Ordenar y rellenar huecos sólo si los rangos tienen edades (o son todos null -> segmentar)
    const allNullAges = list.every(r=> r.edadMin==null && r.edadMax==null);
    if (allNullAges) {
      // Si existe al menos un valor numérico, conservarlo como bloque único 0-120
      const withValues = list.find(r => r.valorMin != null || r.valorMax != null);
      if (withValues) {
        return [{ ...withValues, edadMin:0, edadMax:120 }];
      }
      return segmentsFallback.map(([a,b])=>({ sexo, edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }));
    }
    const filtered = list.map(r=>({ ...r, edadMin: r.edadMin==null?0:r.edadMin, edadMax: r.edadMax==null?120:r.edadMax })).sort((a,b)=> a.edadMin - b.edadMin);
    const out=[]; let cursor=0;
    for (const r of filtered){
      if (r.edadMin>cursor) {
        out.push({ sexo, edadMin:cursor, edadMax:r.edadMin-1, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
      }
      out.push(r);
      cursor = Math.max(cursor, r.edadMax+1);
      if (cursor>120) break;
    }
    if (cursor<=120) out.push({ sexo, edadMin:cursor, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
    return out;
  }
  // Si sólo hay Ambos, procesar directo
  if (sexes.length===1 && sexes[0]==='Ambos') {
    return expandIfNeeded(mapped,'Ambos');
  }
  // Separar por sexo y asegurar cobertura
  const bySex = { Masculino: mapped.filter(r=>r.sexo==='Masculino'), Femenino: mapped.filter(r=>r.sexo==='Femenino') };
  const outFinal = [];
  if (bySex.Masculino.length) outFinal.push(...expandIfNeeded(bySex.Masculino,'Masculino'));
  if (bySex.Femenino.length) outFinal.push(...expandIfNeeded(bySex.Femenino,'Femenino'));
  return outFinal;
}
