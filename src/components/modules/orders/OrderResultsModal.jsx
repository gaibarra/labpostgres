import React, { useState, useEffect, useMemo } from 'react';
import ErrorBoundary from '@/components/common/ErrorBoundary.jsx';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import { Label } from '@/components/ui/label';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { useToast } from "@/components/ui/use-toast";
  import { FileEdit, Beaker, AlertTriangle, Info, Package } from 'lucide-react';
    import { cn } from "@/lib/utils";
    import { useEvaluationUtils } from './report_utils/evaluationUtils.js';
    import { useOrderManagement } from './hooks/useOrderManagement.js';
    import { formatInTimeZone } from '@/lib/dateUtils';

  import { Badge } from '@/components/ui/badge';
  import AntibiogramEditor from './AntibiogramEditor.jsx';
  const OrderResultsModal = ({ isOpen, onOpenChange, order, studiesDetails, packagesData, patient, onSaveResults, onValidateAndPreview, workflowStage }) => {
  const { toast: _toastUnused } = useToast();
      const [resultsData, setResultsData] = useState({});
      const [orderStatus, setOrderStatus] = useState(order?.status || 'Pendiente');
      const [validationNotes, setValidationNotes] = useState(order?.validation_notes || '');
      const { calculateAgeInUnits, getReferenceRangeText, evaluateResult } = useEvaluationUtils();
      const { getStudiesAndParametersForOrder } = useOrderManagement();

      const patientAgeData = useMemo(() => {
        if (patient?.date_of_birth) {
          return calculateAgeInUnits(patient.date_of_birth);
        }
        return { ageYears: 0, unit: 'años', fullMonths: 0, fullDays: 0, fullWeeks: 0, fullHours: 0 };
      }, [patient?.date_of_birth, calculateAgeInUnits]);

  const studiesToDisplay = useMemo(() => {
        if (!order || !studiesDetails || !packagesData) return [];
        return getStudiesAndParametersForOrder(order.selected_items, studiesDetails, packagesData);
      }, [order, studiesDetails, packagesData, getStudiesAndParametersForOrder]);

  // Mapea cada estudio a los nombres de paquete(s) desde los que proviene en esta orden
  const studyToPackages = useMemo(() => {
    const map = new Map();
    try {
      const items = Array.isArray(order?.selected_items) ? order.selected_items : [];
      const pkgIds = items
        .filter(it => (it.type || it.item_type) === 'package')
        .map(it => it.id || it.item_id)
        .filter(Boolean);
      if (!pkgIds.length) return map;
      const pkgsById = new Map((packagesData || []).map(p => [p.id, p]));
      const allStudies = new Set((studiesToDisplay || []).map(s => s.id));
      pkgIds.forEach(pid => {
        const pkg = pkgsById.get(pid);
        if (!pkg || !Array.isArray(pkg.items)) return;
        const pkgName = pkg.name || 'Paquete';
        pkg.items.forEach(sub => {
          const sid = sub?.item_id;
          if (!sid || !allStudies.has(sid)) return;
          const prev = map.get(sid) || [];
          if (!prev.includes(pkgName)) prev.push(pkgName);
          map.set(sid, prev);
        });
      });
    } catch (e) { /* ignore mapping errors */ }
    return map;
  }, [order?.selected_items, packagesData, studiesToDisplay]);

  // Estilos de chip por paquete (determinista por nombre)
  const pkgChipVariants = useMemo(() => ([
    {
      light: 'bg-sky-50/80 border-sky-200 text-sky-800',
      dark: 'dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-200',
    },
    {
      light: 'bg-indigo-50/80 border-indigo-200 text-indigo-800',
      dark: 'dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-200',
    },
    {
      light: 'bg-violet-50/80 border-violet-200 text-violet-800',
      dark: 'dark:bg-violet-900/30 dark:border-violet-800 dark:text-violet-200',
    },
    {
      light: 'bg-emerald-50/80 border-emerald-200 text-emerald-800',
      dark: 'dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200',
    },
    {
      light: 'bg-teal-50/80 border-teal-200 text-teal-800',
      dark: 'dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-200',
    },
    {
      light: 'bg-amber-50/80 border-amber-200 text-amber-800',
      dark: 'dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200',
    },
    {
      light: 'bg-rose-50/80 border-rose-200 text-rose-800',
      dark: 'dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-200',
    },
    {
      light: 'bg-fuchsia-50/80 border-fuchsia-200 text-fuchsia-800',
      dark: 'dark:bg-fuchsia-900/30 dark:border-fuchsia-800 dark:text-fuchsia-200',
    },
  ]), []);

  const pkgChipClassFor = (name) => {
    const s = String(name || 'pkg');
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % pkgChipVariants.length;
    const variant = pkgChipVariants[idx];
    return cn('sticky top-0 z-10 w-fit backdrop-blur px-3 py-1.5 rounded-md border font-semibold text-sm md:text-base flex items-center', variant.light, variant.dark);
  };

  // Agrupa los estudios de la orden por paquete (encabezados visibles) y lista estudios sueltos
  const packageGroups = useMemo(() => {
    const groups = { orderedPkgIds: [], byId: new Map(), assigned: new Set(), orphans: [] };
    try {
      const selected = Array.isArray(order?.selected_items) ? order.selected_items : [];
      const pkgsById = new Map((packagesData || []).map(p => [p.id, p]));
      const orderedPkgIds = selected
        .filter(it => (it.type || it.item_type) === 'package')
        .map(it => it.id || it.item_id)
        .filter(Boolean);
      groups.orderedPkgIds = orderedPkgIds;

      // Inicializa grupos
      orderedPkgIds.forEach(pid => {
        const pkg = pkgsById.get(pid);
        if (pkg && !groups.byId.has(pid)) {
          groups.byId.set(pid, { id: pid, name: pkg.name || 'Paquete', studyIds: new Set() });
        }
      });

      // Asignar estudios al primer paquete en el que aparezcan
      orderedPkgIds.forEach(pid => {
        const pkg = pkgsById.get(pid);
        const group = groups.byId.get(pid);
        if (!pkg || !Array.isArray(pkg.items) || !group) return;
        pkg.items.forEach(sub => {
          const sid = sub?.item_id;
          if (!sid) return;
          // Sólo considerar estudios que están efectivamente en la vista (expandidos)
          if (!(studiesToDisplay || []).some(s => s.id === sid)) return;
          if (!groups.assigned.has(sid)) {
            group.studyIds.add(sid);
            groups.assigned.add(sid);
          }
        });
      });

      // Orphans: estudios seleccionados que no pertenecen a paquetes (o añadidos individualmente)
      (studiesToDisplay || []).forEach(s => {
        if (!groups.assigned.has(s.id)) groups.orphans.push(s.id);
      });
  } catch (_) { /* no-op grouping error */ }
    return groups;
  }, [order?.selected_items, packagesData, studiesToDisplay]);

  const [abgOpen, setAbgOpen] = useState(false);
  const abgStudy = useMemo(()=> (studiesToDisplay||[]).find(s => s?.name === 'Antibiograma' || String(s?.clave||'').toUpperCase() === 'ABG'), [studiesToDisplay]);

      useEffect(() => {
        if (order && studiesToDisplay.length > 0 && patient) {
          const initialResults = {};
          studiesToDisplay.forEach(studyDetail => {
            if (studyDetail && studyDetail.id && Array.isArray(studyDetail.parameters)) {
              initialResults[studyDetail.id] = studyDetail.parameters.map(param => {
                const existingResultForStudy = order.results?.[studyDetail.id];
                // Normaliza tipos para comparación robusta (string vs number vs uuid)
                const existingParamResult = Array.isArray(existingResultForStudy) 
                  ? existingResultForStudy.find(r => String(r.parametroId) === String(param.id))
                  : null;
                
                return {
                  parametroId: param.id,
                  nombreParametro: param.name,
                  valor: existingParamResult?.valor === null || existingParamResult?.valor === undefined ? '' : String(existingParamResult.valor),
                  unit: param.unit || studyDetail.general_units || '',
                  reference_ranges: param.reference_ranges || [],
                };
              });
            } else if (studyDetail && studyDetail.id) {
               initialResults[studyDetail.id] = []; 
            }
          });
          setResultsData(initialResults);
          setOrderStatus(order.status || 'Pendiente');
          setValidationNotes(order.validation_notes || '');
        } else if (order) {
          setResultsData({});
          setOrderStatus(order.status || 'Pendiente');
          setValidationNotes(order.validation_notes || '');
        }
      }, [order, studiesToDisplay, patient]);


      if (!order || !patient) return null;

      const handleResultChange = (studyId, paramIndex, value) => {
        setResultsData(prev => ({
          ...prev,
          [studyId]: prev[studyId].map((param, idx) =>
            idx === paramIndex ? { ...param, valor: value } : param
          )
        }));
      };

      const mergeWithExisting = (partialEdited) => {
        const existing = order.results || {};
        const merged = { ...existing };
        Object.keys(partialEdited).forEach(studyId => {
          const editedSet = partialEdited[studyId] || [];
          const existingSet = Array.isArray(existing[studyId]) ? existing[studyId] : [];
          const map = new Map();
          existingSet.forEach(r => map.set(String(r.parametroId), { ...r }));
          editedSet.forEach(r => map.set(String(r.parametroId), { ...map.get(String(r.parametroId)), ...r }));
          merged[studyId] = Array.from(map.values());
        });
        return merged;
      };

      const logEditSnapshot = (label) => {
        try {
          const studyKeys = Object.keys(resultsData || {});
          const totalParams = studyKeys.reduce((a,k)=> a + (Array.isArray(resultsData[k])?resultsData[k].length:0),0);
          console.debug('[RESULTS][EDIT]', { action: label, studies: studyKeys.length, totalParams, studyKeys });
  } catch (e) { /* ignore snapshot log error */ }
      };

      const handleSave = () => {
        logEditSnapshot('save');
        const edited = {};
        for (const studyId in resultsData) {
          if (Array.isArray(resultsData[studyId])) {
            edited[studyId] = resultsData[studyId].map(param => ({
              parametroId: param.parametroId,
              valor: param.valor === '' ? null : param.valor,
            }));
          }
        }
        const merged = mergeWithExisting(edited);
        onSaveResults(order.id, merged, orderStatus, validationNotes);
      };

      const handleValidateAndPreviewAction = () => {
        logEditSnapshot('validate_preview');
        const edited = {};
        for (const studyId in resultsData) {
          if (Array.isArray(resultsData[studyId])) {
            edited[studyId] = resultsData[studyId].map(param => ({
              parametroId: param.parametroId,
              valor: param.valor === '' ? null : param.valor,
            }));
          }
        }
        const merged = mergeWithExisting(edited);
        onValidateAndPreview(order.id, merged, orderStatus, validationNotes);
      };

      const stageVariant = (workflowStage) => {
        switch (workflowStage) {
          case 'draft': return 'secondary';
          case 'editing': return 'default';
          case 'validated': return 'success';
          case 'delivered': return 'outline';
          default: return 'secondary';
        }
      };

      return (
        <ErrorBoundary dialogStates={{ modal: 'OrderResultsModal', open: isOpen }}>
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-4xl bg-slate-50 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sky-700 dark:text-sky-400 flex items-center">
                <FileEdit className="h-6 w-6 mr-2 text-sky-500" />
                Registrar Resultados | {order.folio}
                <span className="ml-3"><Badge variant={stageVariant(workflowStage)}>{workflowStage || 'idle'}</Badge></span>
              </DialogTitle>
              <DialogDescription>
                Paciente: {patient?.full_name || 'N/A'} | Fecha Orden: {formatInTimeZone(order.order_date, "dd/MM/yyyy")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-3 space-y-3">
              {studiesToDisplay.length === 0 && (
                <Card className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center text-yellow-700 dark:text-yellow-300">
                      <Info className="h-5 w-5 mr-2" />
                      <p className="text-sm">No hay estudios con parámetros para registrar en esta orden, o los estudios incluidos en los paquetes no tienen parámetros definidos.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Paquetes en orden de selección */}
              {packageGroups.orderedPkgIds.map(pid => {
                const group = packageGroups.byId.get(pid);
                if (!group || group.studyIds.size === 0) return null;
                const groupName = group.name;
                const groupStudies = (studiesToDisplay || []).filter(s => group.studyIds.has(s.id));
                return (
                  <div key={`pkg-${pid}`} className="space-y-1.5">
                    <div className={pkgChipClassFor(groupName)}>
                      <Package className="h-4 w-4 mr-1.5" /> {groupName}
                    </div>
                    {groupStudies.map(studyItem => {
                      const allPkgNames = studyToPackages.get(studyItem.id) || [];
                      const extraBadges = allPkgNames.filter(n => n !== groupName);
                      return (
                        <Card key={studyItem.id} className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                          <CardHeader className="py-1.5 px-3">
                            <div className="flex items-center justify-between gap-3">
                              <CardTitle className="text-base text-sky-700 dark:text-sky-300 flex items-center">
                                <Beaker className="h-5 w-5 mr-2"/> {studyItem.name} {studyItem.clave ? `(${studyItem.clave})` : ''}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                {extraBadges.map((n, idx) => (
                                  <Badge key={`${studyItem.id}-pkgextra-${idx}`} variant="secondary" className="text-[10px] py-0.5 px-1.5">{n}</Badge>
                                ))}
                                {(studyItem.name === 'Antibiograma' || String(studyItem.clave||'').toUpperCase() === 'ABG') && (
                                  <Button size="sm" variant="outline" onClick={()=> setAbgOpen(true)}>
                                    Abrir Antibiograma
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-3 py-1.5">
                            {(resultsData[studyItem.id] && resultsData[studyItem.id].length > 0) ? (
                              resultsData[studyItem.id].map((param, paramIndex) => {
                                const resultStatus = param.valor ? evaluateResult(param.valor, param, patient, patientAgeData) : 'no-evaluable';
                                const inputClasses = cn(
                                  "md:col-span-1 bg-white/80 dark:bg-slate-700/80 h-8 py-1 text-sm",
                                  {
                                    "border-red-500 focus-visible:ring-red-500": resultStatus === 'bajo' || resultStatus === 'alto' || resultStatus === 'invalido-alfanumerico',
                                    "border-yellow-500 focus-visible:ring-yellow-500": resultStatus === 'no-numerico',
                                  }
                                );
                                return (
                                  <div key={`${studyItem.id}-${param.parametroId}-${paramIndex}`} className="grid grid-cols-1 md:grid-cols-5 gap-1.5 items-center border-b dark:border-slate-700 py-1.5 last:border-b-0">
                                    <Label htmlFor={`result-${studyItem.id}-${paramIndex}`} className="text-[12px] leading-tight md:col-span-2">
                                      {param.nombreParametro}
                                    </Label>
                                    <div className="relative md:col-span-1">
                                      <Input
                                        id={`result-${studyItem.id}-${paramIndex}`}
                                        value={param.valor}
                                        onChange={(e) => handleResultChange(studyItem.id, paramIndex, e.target.value)}
                                        placeholder="Ingresar valor"
                                        className={inputClasses}
                                      />
                                      {(resultStatus === 'bajo' || resultStatus === 'alto' || resultStatus === 'invalido-alfanumerico') && (
                                        <AlertTriangle className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                                      )}
                                    </div>
                                    <p className="text-[11px] leading-tight text-muted-foreground md:col-span-2">
                                        Ref: {getReferenceRangeText(param, patient, patientAgeData)}
                                    </p>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-muted-foreground">Este estudio no tiene parámetros configurados para resultados o no se pudieron cargar.</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })}

              {/* Estudios individuales (no asignados a paquete) */}
              {packageGroups.orphans.length > 0 && (
                <div className="space-y-1.5">
                  <div className="sticky top-0 z-10 w-fit bg-slate-100/80 dark:bg-slate-800/40 backdrop-blur px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm md:text-base flex items-center">
                    <Beaker className="h-4 w-4 mr-1.5" /> Estudios individuales
                  </div>
                  {(studiesToDisplay || []).filter(s => packageGroups.orphans.includes(s.id)).map(studyItem => (
                    <Card key={studyItem.id} className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                      <CardHeader className="py-1.5 px-3">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-base text-sky-700 dark:text-sky-300 flex items-center">
                            <Beaker className="h-5 w-5 mr-2"/> {studyItem.name} {studyItem.clave ? `(${studyItem.clave})` : ''}
                          </CardTitle>
                          {(studyItem.name === 'Antibiograma' || String(studyItem.clave||'').toUpperCase() === 'ABG') && (
                            <Button size="sm" variant="outline" onClick={()=> setAbgOpen(true)}>
                              Abrir Antibiograma
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 py-1.5">
                        {(resultsData[studyItem.id] && resultsData[studyItem.id].length > 0) ? (
                          resultsData[studyItem.id].map((param, paramIndex) => {
                            const resultStatus = param.valor ? evaluateResult(param.valor, param, patient, patientAgeData) : 'no-evaluable';
                            const inputClasses = cn(
                              "md:col-span-1 bg-white/80 dark:bg-slate-700/80 h-8 py-1 text-sm",
                              {
                                "border-red-500 focus-visible:ring-red-500": resultStatus === 'bajo' || resultStatus === 'alto' || resultStatus === 'invalido-alfanumerico',
                                "border-yellow-500 focus-visible:ring-yellow-500": resultStatus === 'no-numerico',
                              }
                            );
                            return (
                              <div key={`${studyItem.id}-${param.parametroId}-${paramIndex}`} className="grid grid-cols-1 md:grid-cols-5 gap-1.5 items-center border-b dark:border-slate-700 py-1.5 last:border-b-0">
                                <Label htmlFor={`result-${studyItem.id}-${paramIndex}`} className="text-[12px] leading-tight md:col-span-2">
                                  {param.nombreParametro}
                                </Label>
                                <div className="relative md:col-span-1">
                                  <Input
                                    id={`result-${studyItem.id}-${paramIndex}`}
                                    value={param.valor}
                                    onChange={(e) => handleResultChange(studyItem.id, paramIndex, e.target.value)}
                                    placeholder="Ingresar valor"
                                    className={inputClasses}
                                  />
                                  {(resultStatus === 'bajo' || resultStatus === 'alto' || resultStatus === 'invalido-alfanumerico') && (
                                    <AlertTriangle className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                                  )}
                                </div>
                                <p className="text-[11px] leading-tight text-muted-foreground md:col-span-2">
                                    Ref: {getReferenceRangeText(param, patient, patientAgeData)}
                                </p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">Este estudio no tiene parámetros configurados para resultados o no se pudieron cargar.</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              <Card className="bg-white dark:bg-slate-800/50">
                <CardHeader><CardTitle className="text-lg text-sky-600 dark:text-sky-400">Estado y Validación</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="orderStatus" className="text-slate-700 dark:text-slate-300">Estado de la Orden</Label>
                    <Select value={orderStatus} onValueChange={setOrderStatus}>
                      <SelectTrigger className="bg-white/80 dark:bg-slate-700/80"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                        <SelectItem value="Procesando">Procesando</SelectItem>
                        <SelectItem value="Concluida">Concluida (Resultados Parciales)</SelectItem>
                        <SelectItem value="Reportada">Reportada (Resultados Finales)</SelectItem>
                        <SelectItem value="Cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="validationNotes" className="text-slate-700 dark:text-slate-300">Notas de Validación / Observaciones</Label>
                    <Textarea
                      id="validationNotes"
                      value={validationNotes}
                      onChange={(e) => setValidationNotes(e.target.value)}
                      placeholder="Anotaciones sobre los resultados, validación, etc."
                      className="bg-white/80 dark:bg-slate-700/80"
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    {abgStudy && (
                      <Button variant="outline" type="button" onClick={()=> setAbgOpen(true)}>
                        Abrir Antibiograma
                      </Button>
                    )}
                    <Button variant="secondary" type="button" onClick={handleSave}>Guardar Borrador</Button>
                    <Button variant="default" type="button" onClick={handleValidateAndPreviewAction}>Validar y Previsualizar</Button>
                    <DialogClose asChild>
                      <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cerrar</Button>
                    </DialogClose>
                  </div>
                </CardContent>
              </Card>

              {abgStudy && (
                <AntibiogramEditor open={abgOpen} onOpenChange={setAbgOpen} workOrder={order} analysisId={abgStudy.id} />
              )}
            </div>
            <DialogFooter className="pt-2" />
          </DialogContent>
        </Dialog>
        </ErrorBoundary>
      );
    };

    export default OrderResultsModal;