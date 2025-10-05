import React, { useState, useRef, useEffect } from 'react';
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
export default function AIAssistParameterDialog({ isOpen, onOpenChange, studyId, studyName, existingParameters = [], onAccept }) {
  // NUEVA UX: solo captura nombre con opción de sugerencia IA (una sola a la vez)
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestMeta, setSuggestMeta] = useState(null); // guarda respuesta completa si backend trae más que nombre
  const abortRef = useRef(null);

  const lowerExisting = (existingParameters || []).map(p => (typeof p === 'string' ? p : p?.name || '')).filter(Boolean).map(s=>s.toLowerCase());
  const duplicate = name.trim() !== '' && lowerExisting.includes(name.trim().toLowerCase());
  const canAccept = name.trim().length >= 2 && !duplicate && !loading;
  const canSuggest = !!studyId && !!studyName && !loading; // no exigimos longitud mínima ya que es asistido

  // Reset al abrir/cerrar
  useEffect(()=>{
    if (!isOpen) {
      setName('');
      setError(null);
      setSuggestMeta(null);
      if (abortRef.current) abortRef.current.abort();
    }
  }, [isOpen]);

  const handleSuggest = async () => {
    if (!canSuggest) return;
    setLoading(true); setError(null);
    setSuggestMeta(null);
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Construimos un prompt interno breve reutilizando el endpoint actual sin exponer campo libre.
      const internalPrompt = `Genera un único nombre claro y conciso para un parámetro de laboratorio dentro del estudio: ${studyName}. Solo devuelve el nombre.`;
      const resp = await fetch('/api/analysis/ai/generate-parameter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId, studyName, prompt: internalPrompt, existingParameters }),
        signal: controller.signal
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`HTTP ${resp.status} - ${txt}`);
      }
      const data = await resp.json();
      if (data?.parameter?.name) {
        setName(data.parameter.name);
        setSuggestMeta(data.parameter);
        // Si el nombre sugerido es duplicado, avisamos pero lo dejamos editable.
        if (lowerExisting.includes(data.parameter.name.toLowerCase())) {
          setError('La sugerencia coincide con un parámetro existente, ajusta el nombre.');
        }
      } else {
        setError('Respuesta IA sin nombre válido.');
      }
    } catch(e){
      if (e.name === 'AbortError') return; // silencio
      setError(e.message || 'Fallo al sugerir');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (!canAccept) return;
    const param = suggestMeta ? { ...suggestMeta, name: name.trim() } : { name: name.trim(), reference_ranges: [], unit: null };
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
            <label className="text-xs font-medium">Nombre del parámetro</label>
            <Input value={name} onChange={e=>{ setName(e.target.value); if(error && !duplicate) setError(null); }} placeholder="Ej: Índice inflamatorio tiroideo" autoFocus disabled={loading} />
            {duplicate && <p className="text-[11px] text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Ya existe un parámetro con ese nombre.</p>}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button type="button" size="sm" onClick={handleSuggest} disabled={!canSuggest} className="bg-purple-600 hover:bg-purple-700 text-white">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} {loading ? 'Sugiriendo...' : 'Sugerir nombre'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleReset} disabled={loading && !name}>
              <RotateCcw className="mr-2 h-4 w-4" /> Limpiar
            </Button>
            <div className="ml-auto" />
            <Button type="button" size="sm" onClick={handleAccept} disabled={!canAccept} className="bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-700 text-white">Aceptar</Button>
          </div>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          {suggestMeta && (
            <div className="border rounded-md p-3 bg-slate-50 dark:bg-slate-800/40 space-y-2">
              <p className="text-xs font-semibold opacity-70">Sugerencia IA</p>
              <p className="text-sm"><span className="font-medium">Nombre sugerido:</span> {suggestMeta.name}</p>
              {(suggestMeta.unit || (suggestMeta.reference_ranges && suggestMeta.reference_ranges.length)) && (
                <>
                  <p className="text-sm"><span className="font-medium">Unidad:</span> {suggestMeta.unit || '—'}</p>
                  {suggestMeta.reference_ranges?.length > 0 && (
                    <div>
                      <p className="text-sm"><span className="font-medium">Rangos sugeridos:</span></p>
                      <ScrollArea className="max-h-24 pr-2">
                        <ul className="text-[11px] space-y-1">
                          {suggestMeta.reference_ranges.map((r,i)=>(
                            <li key={i}>({r.sex}{r.age_min!=null||r.age_max!=null?`, ${r.age_min??''}-${r.age_max??''} ${r.age_min_unit||''}`:''}): {r.lower!=null?`${r.lower}`:''}{r.lower!=null||r.upper!=null?' - ':''}{r.upper!=null?`${r.upper}`:''}{r.text_value?` ${r.text_value}`:''}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}
              {suggestMeta.notes && <p className="text-[11px] italic opacity-75">{suggestMeta.notes}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
