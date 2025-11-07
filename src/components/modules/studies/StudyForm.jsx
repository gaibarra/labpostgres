import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import StudyParameters from '@/components/modules/studies/StudyParameters';
import { Sparkles, Loader2, Info, Save, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
// import { toast } from 'sonner'; // (no utilizado actualmente)

const studyCategories = [
  'Hematología', 'Química Clínica', 'Inmunología', 'Microbiología', 'Uroanálisis',
  'Parasitología', 'Endocrinología', 'Marcadores Tumorales', 'Otros'
];

const slugify = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 20);

const StudyForm = forwardRef(function StudyFormFwd({ initialStudy, onSubmit, onCancel, isSubmitting, onAIAssist, onImmediateParameterSave, onImmediateParameterDelete, onPersistParameterOrder, invalidHighlight }, ref) {
  const [study, setStudy] = useState(initialStudy);
  const [showParameters, setShowParameters] = useState(true);
  const paramsCompRef = useRef(null);
  const lastHighlightRef = useRef(null);
  const highlightTimerRef = useRef(null);
  // Importante: NO usar el hook genérico useStudies aquí porque no sincroniza rangos de referencia.
  // El componente padre (Studies.jsx) inyecta onSubmit que ya ejecuta:
  // 1) upsert del estudio
  // 2) sync de parámetros
  // 3) sync de reference_ranges (valores de referencia)
  // Antes se llamaba a otro syncParameters local que ignoraba valorReferencia, provocando que
  // los cambios en valores de referencia no se persistieran. Se elimina esa lógica duplicada.

  useEffect(() => {
    setStudy(initialStudy);
    if (initialStudy?.parameters?.length > 0) setShowParameters(true);
  }, [initialStudy]);

  // Efecto: cuando recibimos invalidHighlight, expandimos parámetros, abrimos el parámetro e intentamos resaltar el rango
  useEffect(() => {
    if (!invalidHighlight) return;
    if (lastHighlightRef.current && lastHighlightRef.current.ts === invalidHighlight.ts) return; // ya aplicado
    lastHighlightRef.current = invalidHighlight;
    // Asegura que la sección de parámetros está visible
    if (!showParameters) setShowParameters(true);
    // Timeout pequeño para esperar render
    requestAnimationFrame(() => {
      try {
        // Abrir diálogo del parámetro correspondiente si ref expone método
        paramsCompRef.current?.openParameterByIndex?.(invalidHighlight.paramIndex);
  } catch (e) { /* ignore highlight open error */ }
      // Intentar localizar el contenedor del rango dentro del diálogo de edición (usa data atributos que añadiremos más adelante)
      setTimeout(() => {
        const selector = `[data-param-index="${invalidHighlight.paramIndex}"][data-range-index="${invalidHighlight.rangeIndex}"]`;
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-red-500', 'animate-pulse');
          highlightTimerRef.current && clearTimeout(highlightTimerRef.current);
          highlightTimerRef.current = setTimeout(() => {
            el.classList.remove('ring-2', 'ring-red-500', 'animate-pulse');
          }, 4000);
          // Intentar focos en primer input interno
          const focusable = el.querySelector('input,select,textarea,button');
          focusable?.focus?.();
        }
      }, 120); // margen para que se monte el diálogo
    });
  }, [invalidHighlight, showParameters]);

  useEffect(()=>()=>{ if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); },[]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setStudy(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
  };

  const handleSelectChange = (name, value) => {
    setStudy(prev => ({ ...prev, [name]: value }));
  };

  const handleNameBlur = () => {
    if (!study.clave && study.name) {
      const gen = slugify(study.name);
      if (gen) setStudy(prev => ({ ...prev, clave: gen }));
    }
  };

  const handleFormSubmit = async () => {
    // Obtén los parámetros más recientes del ref si existen
  const latestParameters = paramsCompRef.current?.getParameters?.() || study.parameters;
  // Profunda copia para asegurar que valorReferencia se mantenga intacto
  const safeParams = Array.isArray(latestParameters) ? latestParameters : [];
  const studyToSave = { ...study, parameters: typeof structuredClone === 'function' ? structuredClone(safeParams) : JSON.parse(JSON.stringify(safeParams)) };
  // Delegamos completamente al onSubmit provisto por el padre (handleSubmit avanzado)
  // que se encarga de persistir parámetros y valores de referencia.
  await onSubmit(studyToSave);
  };

  const handleAddParameterClick = () => {
    if (!showParameters) setShowParameters(true);
    paramsCompRef.current?.openNew?.();
  };

  // Ya no exponemos addAIParameter (flujo IA eliminado)
  useImperativeHandle(ref, () => ({ /* reservado para futuras extensiones */ }), []);

  const handleParametersChange = (newParameters) => {
    const arr = Array.isArray(newParameters) ? newParameters : [];
    const cloned = typeof structuredClone === 'function' ? structuredClone(arr) : JSON.parse(JSON.stringify(arr));
    setStudy(prev => ({ ...prev, parameters: cloned }));
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-grow p-1 pr-4">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Detalles del Estudio</h3>
            <Button
              type="button"
              variant="outline"
              onClick={onAIAssist}
              className="bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-800/70 text-purple-700 dark:text-purple-300 w-full sm:w-auto"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Usar Asistente IA
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <Label htmlFor="name">Nombre del Estudio</Label>
              <Input id="name" name="name" value={study.name || ''} onChange={handleChange} onBlur={handleNameBlur} disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="clave">Clave</Label>
              <Input id="clave" name="clave" value={study.clave || ''} onChange={handleChange} placeholder="Automático" disabled={isSubmitting} />
              <p className="text-xs text-muted-foreground mt-1">
                <Info className="inline h-3 w-3 mr-1" />
                Si se deja en blanco, se generará una clave.
              </p>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="category">Categoría</Label>
              <SearchableSelect
                value={study.category || ''}
                onValueChange={(val) => handleSelectChange('category', val)}
                options={studyCategories.map(cat => ({ value: cat, label: cat }))}
                placeholder="Seleccione una categoría"
                searchPlaceholder="Buscar categoría..."
                emptyText="Sin categorías"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="particularPrice">Precio Particular ($)</Label>
            <div className="flex items-center gap-2">
              <Input id="particularPrice" name="particularPrice" type="number" step="0.01" value={study.particularPrice || ''} onChange={handleChange} disabled={isSubmitting} />
              {study.id && (
                <Button type="button" onClick={handleFormSubmit} size="sm" className="bg-teal-500 hover:bg-teal-600 text-white" disabled={isSubmitting}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" value={study.description || ''} onChange={handleChange} disabled={isSubmitting} />
          </div>

          <div>
            <Label htmlFor="indications">Indicaciones para el Paciente</Label>
            <Textarea id="indications" name="indications" value={study.indications || ''} onChange={handleChange} disabled={isSubmitting} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sample_type">Tipo de Muestra</Label>
              <Input id="sample_type" name="sample_type" value={study.sample_type || ''} onChange={handleChange} disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="sample_container">Contenedor de Muestra</Label>
              <Input id="sample_container" name="sample_container" value={study.sample_container || ''} onChange={handleChange} disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="processing_time_hours">Tiempo de Proceso (horas)</Label>
              <Input id="processing_time_hours" name="processing_time_hours" type="number" value={study.processing_time_hours || ''} onChange={handleChange} disabled={isSubmitting} />
            </div>
          </div>

          {/* ---- SECCIÓN DE PARÁMETROS ---- */}
          <div className="pt-2 relative z-10">
            <Collapsible open={showParameters} onOpenChange={setShowParameters}>
              <div className="mx-auto w-full max-w-5xl rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-900/30">
                <div className="flex flex-wrap gap-2 items-center justify-between px-3 py-2">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Parámetros a reportar</h4>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddParameterClick}
                      className="text-sky-600 border-sky-600 hover:bg-sky-100 dark:text-sky-400 dark:border-sky-400 dark:hover:bg-slate-800/60"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Añadir Parámetro
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
                        {showParameters ? <><ChevronUp className="mr-1 h-4 w-4" /> Ocultar</> : <><ChevronDown className="mr-1 h-4 w-4" /> Mostrar</>}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent>
                  <div
                    className="px-3 pb-3 max-h-[60vh] overflow-y-auto overscroll-contain pr-2 scrollbar-thin"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    <StudyParameters
                      ref={paramsCompRef}
                      parameters={study.parameters || []}
                      onParametersChange={handleParametersChange}
                      isSubmitting={isSubmitting}
                      studyId={study.id}
                      onImmediateSave={onImmediateParameterSave}
                      onImmediateDelete={onImmediateParameterDelete}
                      onPersistOrder={onPersistParameterOrder}
                      enableRangeDataAttributes
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        </div>
      </ScrollArea>

      <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="button" onClick={handleFormSubmit} disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : (study.id ? 'Actualizar Estudio' : 'Guardar Estudio')}
        </Button>
      </div>
    </div>
  );
});
StudyForm.displayName = 'StudyForm';

export default StudyForm;
