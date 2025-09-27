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
  const TOTAL_TIMEOUT_MS = 180000; // 180s
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
    if (pollAbort) { try { pollAbort.abort(); } catch {} }
    setPollAbort(null);
  if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
  };

  useEffect(() => {
    if (!settings) { setIsLoadingSettings(true); return; }
    setIsLoadingSettings(false);
    setApiKey(settings?.integrations?.openaiApiKey || '');
  }, [settings]);

  useEffect(() => () => { if (pollAbort) try { pollAbort.abort(); } catch {} }, [pollAbort]);

  function processResult(generatedData){
    const formattedParameters = (generatedData.parameters || []).map(param => {
      const name = param.name || param.nombre || '';
      const unit = param.unit || param.unidad || '';
      const decimal_places = param.decimal_places || param.decimalPlaces || 0;
      return {
        name,
        unit,
        decimal_places,
        position: null,
        valorReferencia: (param.valorReferencia || param.reference_values || []).map(vr => ({
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
        }))
      };
    });
    const updatedFormData = {
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
      category: generatedData.category || '',
      particularPrice: '',
      ai_meta: generatedData.ai_meta || null,
    };
    if (formattedParameters.length === 0) {
      toast({ title:'Sin parámetros generados', description:'La IA no devolvió parámetros.', variant:'destructive' });
    } else if (generatedData?.ai_meta?.salvaged) {
      toast({ title:'Resultado recuperado', description:'Se reparó el JSON inválido.', variant:'default' });
    }
    onGenerationSuccess(updatedFormData);
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
      const timePct = Math.min(99, Math.floor((elapsed / TOTAL_TIMEOUT_MS) * 100));
      setProgress(prev => prev < timePct ? timePct : prev);
    }, 1000);
    const tick = async () => {
      if (ac.signal.aborted) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > TOTAL_TIMEOUT_MS) { // 180s
        ac.abort();
        setIsGenerating(false);
        toast({ title:'Tiempo excedido', description:'>180s sin completar.', variant:'destructive' });
        if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
        resetState();
        return;
      }
      try {
        const data = await apiClient.get(`/ai/generate-study-details/job/${id}`, { timeoutMs: 12000 });
  const serverPct = parseInt(data.progress || 0, 10);
  setProgress(prev => Math.max(prev, isNaN(serverPct) ? 0 : serverPct));
        setProgressMsg(data.message || '');
        if (data.status === 'done' && data.result) {
          processResult(data.result);
          setIsGenerating(false);
          setProgress(100);
          if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
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
    try {
      const resp = await apiClient.post('/ai/generate-study-details/async', { studyName }, { timeoutMs: 15000 });
      if (!resp?.jobId) throw new Error('No se obtuvo jobId');
      setJobId(resp.jobId);
  setProgress(3); // progreso inicial mínimo
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