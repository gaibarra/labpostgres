import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import apiClient from '@/lib/apiClient';
import { useSettings } from '@/contexts/SettingsContext';

const AIAssistDialog = ({ isOpen, onOpenChange, onGenerationSuccess }) => {
  const TOTAL_TIMEOUT_MS = 300000; // 300s (5 min)
  const MIN_PROGRESS = 5; // Progreso mínimo visible para evitar 0% prolongado
  const [studyName, setStudyName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [pollAbort, setPollAbort] = useState(null);
  const progressTimerRef = useRef(null);
  const { settings } = useSettings();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const missingKey = !apiKey;

  const resetState = () => {
    setJobId(null);
    setProgress(0);
    setProgressMsg('');
  if (pollAbort) { try { pollAbort.abort(); } catch (e) { /* ignore */ } }
    setPollAbort(null);
  if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
  };

  useEffect(() => {
    if (!settings) { setIsLoadingSettings(true); return; }
    setIsLoadingSettings(false);
    setApiKey(settings?.integrations?.openaiApiKey || '');
  }, [settings]);

  useEffect(() => () => { if (pollAbort) try { pollAbort.abort(); } catch (e) { /* ignore */ } }, [pollAbort]);

  async function processResult(generatedData){
    function consolidateRanges(ranges){
      const norm = ranges.map(vr => ({
        sexo: vr.sexo || vr.gender || 'Ambos',
        edadMin: vr.edadMin === undefined ? (vr.age_min ?? null) : vr.edadMin,
        edadMax: vr.edadMax === undefined ? (vr.age_max ?? null) : vr.edadMax,
        unidadEdad: vr.unidadEdad || vr.age_unit || 'años',
        valorMin: vr.valorMin === undefined ? (vr.normal_min ?? vr.lower ?? null) : vr.valorMin,
        valorMax: vr.valorMax === undefined ? (vr.normal_max ?? vr.upper ?? null) : vr.valorMax,
        tipoValor: vr.tipoValor || (vr.textoLibre ? 'textoLibre' : (vr.textoPermitido ? 'alfanumerico' : 'numerico')),
        textoPermitido: vr.textoPermitido || '',
        textoLibre: vr.textoLibre || '',
        notas: vr.notas || vr.notes || ''
      }));
      const bySex = {};
      norm.forEach(r=>{ (bySex[r.sexo] = bySex[r.sexo] || []).push(r); });
      const consolidated = [];
      Object.values(bySex).forEach(arr => {
        arr.sort((a,b)=> (a.edadMin??-Infinity) - (b.edadMin??-Infinity));
        let current = null;
        arr.forEach(r => {
          if (!current) { current = { ...r }; return; }
          const compatible = (current.tipoValor === r.tipoValor) && (current.textoLibre||'') === (r.textoLibre||'') && (current.textoPermitido||'') === (r.textoPermitido||'') && (current.valorMin??null) === (r.valorMin??null) && (current.valorMax??null) === (r.valorMax??null) && (current.notas||'') === (r.notas||'');
          const currentEnd = current.edadMax;
          const rStart = r.edadMin;
          if (compatible && (currentEnd == null || rStart == null || currentEnd >= rStart)) {
            current.edadMax = (r.edadMax == null ? current.edadMax : (current.edadMax == null ? r.edadMax : Math.max(current.edadMax, r.edadMax)));
            current.edadMin = (current.edadMin == null ? r.edadMin : current.edadMin);
          } else { consolidated.push(current); current = { ...r }; }
        });
        if (current) consolidated.push(current);
      });
      return consolidated;
    }

    const formattedParameters = (generatedData.parameters || []).map(param => {
      const name = param.name || param.nombre || '';
      // Ampliar alias de unidad
      const unit = param.unit || param.unidad || param.units || param.general_unit || param.medida || '';
      const decimal_places = param.decimal_places || param.decimalPlaces || param.decimals || 0;
      const rawRanges = (param.valorReferencia || param.reference_values || param.reference_ranges || param.rangos || []);
      let valorReferencia = consolidateRanges(rawRanges);
      // Filtro: si existe al menos un rango con valores numéricos definidos, removemos aquellos donde ambos son null
      const hasAnyFilled = valorReferencia.some(r => r.valorMin != null || r.valorMax != null);
      if (hasAnyFilled) {
        valorReferencia = valorReferencia.filter(r => !(r.valorMin == null && r.valorMax == null));
      }
      if (!valorReferencia.length) {
        // Generar placeholders por etapas de vida con nota para edición
        const segments = [
          { min:0, max:1, label:'Neonato/Lactante (0-1a)' },
          { min:1, max:2, label:'Lactante Mayor (1-2a)' },
          { min:2, max:12, label:'Niñez (2-12a)' },
          { min:12, max:18, label:'Adolescencia (12-18a)' },
          { min:18, max:65, label:'Adulto (18-65a)' },
          { min:65, max:120, label:'Adulto Mayor (65-120a)' }
        ];
        valorReferencia = segments.map(s=>({
          sexo:'Ambos', edadMin:s.min, edadMax:s.max, unidadEdad:'años', valorMin:null, valorMax:null, tipoValor:'numerico', textoPermitido:'', textoLibre:'', notas:`(Placeholder ${s.label})`
        }));
      }
      return { name, unit, decimal_places, position: null, valorReferencia };
    });
  let updatedFormData = {
      name: generatedData.name || studyName,
      description: generatedData.description || '',
      indications: generatedData.indications || generatedData.patient_instructions || '',
      sample_type: generatedData.sample_type || generatedData.sampleType || '',
      sample_container: generatedData.sample_container || generatedData.sampleContainer || '',
      processing_time_hours: generatedData.processing_time_hours || '',
      general_units: generatedData.general_units || '',
      parameters: formattedParameters,
      id: null,
      clave: '',
      category: (()=>{
        const rawCat = (generatedData.category || '').toString().trim();
        if (!rawCat) return '';
        const norm = rawCat.normalize('NFD').replace(/\p{Diacritic}/gu,'').toUpperCase();
        const CATS = [
          { norm:'HORMONAS', label:'Hormonas' },
          { norm:'HEMATOLOGIA', label:'Hematología' },
            { norm:'BIOQUIMICA', label:'Bioquímica' },
          { norm:'INMUNOLOGIA', label:'Inmunología' },
          { norm:'MICROBIOLOGIA', label:'Microbiología' },
          { norm:'COAGULACION', label:'Coagulación' },
          { norm:'GENETICA', label:'Genética' },
          { norm:'ORINA', label:'Orina' },
          { norm:'GASES', label:'Gases' },
          { norm:'OTROS', label:'Otros' }
        ];
        const found = CATS.find(c=> c.norm === norm);
        if (found) return found.label;
        // heurísticos -> devolver siempre label en Title Case
        if (/HEMOG|HEMATO|SANG/.test(norm)) return 'Hematología';
        if (/HORM|ENDO|TIROI|T4|T3|TSH/.test(norm)) return 'Hormonas';
        if (/INMUNO|ANTICUER|IGG|IGA|IGM/.test(norm)) return 'Inmunología';
        if (/COAG|TP|TTP|INR|FIBRIN|DDI/.test(norm)) return 'Coagulación';
        if (/MICRO|CULTIVO|BACT|PARAS|COPRO/.test(norm)) return 'Microbiología';
        if (/ORINA|URI|EGO/.test(norm)) return 'Orina';
        if (/GAS|ACIDOBASE|PH/.test(norm)) return 'Gases';
        if (/DNA|GEN|PCR/.test(norm)) return 'Genética';
        if (/GLUC|LIPID|COLEST|UREA|CREAT|TRANSAMI|ALT|AST/.test(norm)) return 'Bioquímica';
        return 'Otros';
      })(),
      particularPrice: '',
      ai_meta: generatedData.ai_meta || null,
    };
    if (formattedParameters.length === 0) {
      toast({ title:'Sin parámetros generados', description:'La IA no devolvió parámetros.', variant:'destructive' });
    } else if (generatedData?.ai_meta?.salvaged) {
      toast({ title:'Resultado recuperado', description:'Se reparó el JSON inválido.', variant:'default' });
    }
    // === Enriquecimiento automático con panel completo (plantillas) ===
  const canonicalMatch = /biometr[ií]a hem(á|a)tica|hemograma( completo)?|perfil\s+tiroid(eo|eo)|tiroideo|perfil\s+hep(á|a)tic|perfil\s+hormonal|perfil\s+ginecol(ó|o)gic|ex[aá]men general de orina|ego\b|perfil\s+geri(á|a)tric|qu(í|i)mica sangu(í|i)nea.*6|qu(í|i)mica.*6 elementos|electrolitos|perfil\s+pre( ?|-)operatorio|preoperatorio|tipo de sangre|grupo sangu(í|i)neo|perfil\s+lip(í|i)dico|perfil\s+renal|perfil\s+card(í|i)ac/i.test(updatedFormData.name || '');
    const alreadyLooksComplete = (updatedFormData.parameters||[]).length >= 15; // heurística simple
    if (canonicalMatch && !alreadyLooksComplete) {
      try {
        setProgress(prev=> prev < 60 ? 60 : prev);
        setProgressMsg('Generando panel completo...');
        // Crear job panel
        const panelResp = await apiClient.post('/ai/generate-panel/async', { studyName: updatedFormData.name }, { timeoutMs: 10000 });
        if (panelResp?.jobId){
          const panelJobId = panelResp.jobId;
          const startedAt = Date.now();
          // Poll simple (sin barra secundaria) integrando al mismo progreso 60->100
          let done = false;
          while(!done){
            await new Promise(r=> setTimeout(r, 1200));
            try {
              const jobData = await apiClient.get(`/ai/generate-panel/job/${panelJobId}`, { timeoutMs: 8000 });
              const serverPct = parseInt(jobData.progress || 0,10);
              // Mapear 0-100 del panel a 60-95 global hasta que termine
              const mapped = 60 + Math.min(35, Math.floor((isNaN(serverPct)?0:serverPct) * 0.35));
              setProgress(p=> p < mapped ? mapped : p);
              setProgressMsg(jobData.message || 'Generando panel completo...');
              if (jobData.status === 'done' && jobData.result?.parameters){
                // Merge de parámetros: priorizar panel (templated) y añadir los extra de la IA inicial no duplicados
                const panelParams = jobData.result.parameters || [];
                const existingByName = new Map((updatedFormData.parameters||[]).map(p=> [p.name?.toLowerCase(), p]));
                const merged = [];
                panelParams.forEach(p=> {
                  if (!p.position) p.position = merged.length + 1;
                  merged.push(p);
                  existingByName.delete(p.name?.toLowerCase());
                });
                // Añadir parámetros originales no cubiertos (si hubiera)
                for (const [_, param] of existingByName){
                  param.position = merged.length + 1;
                  merged.push(param);
                }
                updatedFormData.parameters = merged;
                done = true;
                setProgress(100);
                setProgressMsg('Panel completo listo');
              } else if (jobData.status === 'error') {
                done = true; // fallamos silenciosamente, usamos datos iniciales
                setProgress(prev=> prev < 90 ? 90 : prev);
                setProgressMsg('Panel: error, usando datos iniciales');
              }
              const elapsed = Date.now() - startedAt;
              if (elapsed > 45000) { // timeout panel 45s
                done = true;
                setProgress(prev=> prev < 90 ? 90 : prev);
                setProgressMsg('Panel: timeout, usando datos iniciales');
              }
            } catch(e){ /* continuar polling */ }
          }
        }
      } catch(e){
        // Ignorar error de panel y continuar
        setProgress(prev=> prev < 90 ? 90 : prev);
        setProgressMsg('Panel: fallo, usando datos IA base');
      }
    }
    if (!canonicalMatch) {
      setProgress(100);
    }
    onGenerationSuccess(updatedFormData); // entregar resultado final (enriquecido o base)
    setStudyName('');
  }

  function pollJob(id, startedAt){
    const ac = new AbortController();
    setPollAbort(ac);
  const pollInterval = 1500;
    // Intervalo de progreso lineal basado en tiempo (fallback) para evitar sensación de congelado.
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); }
    progressTimerRef.current = setInterval(()=>{
      if (ac.signal.aborted) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; return; }
      const elapsed = Date.now() - startedAt;
      // Curva por fases para evitar quedarse mucho en 5% y dar sensación de avance.
      // 0-4s: subir rápido a 25%
      // 4-15s: 25% -> 55%
      // 15-60s: 55% -> 75%
      // 60s - 75% tiempo total: 75% -> 90%
      // 75% tiempo total - fin: 90% -> 97%
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
    }, 600);
    const tick = async () => {
      if (ac.signal.aborted) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > TOTAL_TIMEOUT_MS) { // 300s
        ac.abort();
        setIsGenerating(false);
        toast({ title:'Tiempo excedido', description:'>300s (5 min) sin completar.', variant:'destructive' });
        if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
        resetState();
        return;
      }
      try {
    const data = await apiClient.get(`/ai/generate-study-details/job/${id}`, { timeoutMs: 12000 });
    const serverPct = parseInt(data.progress || 0, 10);
    // Se asegura que nunca retroceda y que siempre haya al menos MIN_PROGRESS mientras esté generando
    setProgress(prev => Math.max(prev, MIN_PROGRESS, isNaN(serverPct) ? MIN_PROGRESS : serverPct));
        setProgressMsg(data.message || '');
        if (data.status === 'done' && data.result) {
          // Detenemos el timer aquí pero dejamos que processResult maneje el progreso final (panel)
          if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
          await processResult(data.result);
          setIsGenerating(false);
          resetState();
          return; 
        } else if (data.status === 'error') {
          toast({ title:'Error IA', description: data.error?.message || 'Fallo job IA', variant:'destructive' });
          setIsGenerating(false);
          if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
          resetState();
          return;
        }
      } catch(e){ console.warn('[AIAssistDialog] polling error', e); }
      setTimeout(tick, pollInterval);
    };
    setTimeout(tick, pollInterval);
  }

  const handleGenerate = async () => {
    if (!studyName) {
      toast({ title:'Nombre requerido', description:'Introduce un nombre.', variant:'destructive' });
      return;
    }
    if (missingKey) {
      toast({ title:'Falta clave OpenAI', description:'Configura la clave en Integraciones.', variant:'destructive' });
      return;
    }
    setIsGenerating(true);
    resetState();
    // Mostrar inmediatamente un progreso distinto de 0 para feedback instantáneo.
    setProgress(MIN_PROGRESS);
    setProgressMsg('Creando job...');
    try {
      const resp = await apiClient.post('/ai/generate-study-details/async', { studyName }, { timeoutMs: 15000 });
      if (!resp?.jobId) throw new Error('No se obtuvo jobId');
      setJobId(resp.jobId);
      // Ajuste a un pequeño incremento para indicar que pasó la fase de creación.
      setProgress(prev => Math.max(prev + 2, MIN_PROGRESS + 2));
      setProgressMsg('En cola');
      pollJob(resp.jobId, Date.now());
    } catch(error){
      setIsGenerating(false);
      toast({ title:'Error creando job IA', description:error.message, variant:'destructive' });
    }
  };

  const renderContent = () => {
    if (isLoadingSettings) {
      return (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Cargando configuración...</span>
        </div>
      );
    }
    return (
      <div className="grid gap-4 py-4">
        {missingKey && (
          <div className="rounded-md border border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-900/40 p-3 text-xs text-red-700 dark:text-red-300 space-y-1">
            <div className="font-semibold flex items-center"><AlertTriangle className="h-4 w-4 mr-1"/> Falta clave de OpenAI</div>
            <p>Configura una clave en Configuración → Integraciones.</p>
          </div>
        )}
        {isGenerating && (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span>Generando...</span><span>{progress}%</span></div>
            <div className="h-2 w-full bg-neutral-800 rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500" style={{ width: `${Math.min(progress,100)}%` }} />
            </div>
            {progressMsg && <div className="italic opacity-75">{progressMsg}</div>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="xs" disabled>Job: {jobId?.slice(-8)}</Button>
              <Button type="button" variant="destructive" size="xs" onClick={()=>{ if (pollAbort) pollAbort.abort(); resetState(); setIsGenerating(false); }}>Cancelar</Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="study-name" className="text-right">Estudio</Label>
          <Input id="study-name" value={studyName} onChange={(e)=>setStudyName(e.target.value)} className="col-span-3" placeholder="Ej: Perfil hormonal" disabled={isGenerating} />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
            Asistente IA para Estudios
          </DialogTitle>
          <DialogDescription>
            Introduce el nombre de un estudio clínico y la IA generará sus detalles, parámetros y valores de referencia.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={()=>onOpenChange(false)} disabled={isGenerating}>Cancelar</Button>
          <Button type="button" onClick={handleGenerate} disabled={isGenerating || isLoadingSettings || !studyName || missingKey}>{isGenerating ? 'Generando...' : 'Generar Detalles'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIAssistDialog;