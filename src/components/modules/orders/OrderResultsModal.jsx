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
  import { FileEdit, Beaker, AlertTriangle, Info } from 'lucide-react';
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
            <div className="py-4 space-y-6">
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

              {studiesToDisplay.map(studyItem => (
                <Card key={studyItem.id} className="bg-white dark:bg-slate-800/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-sky-600 dark:text-sky-400 flex items-center">
                        <Beaker className="h-5 w-5 mr-2"/> {studyItem.name} {studyItem.clave ? `(${studyItem.clave})` : ''}
                      </CardTitle>
                      {(studyItem.name === 'Antibiograma' || String(studyItem.clave||'').toUpperCase() === 'ABG') && (
                        <Button size="sm" variant="outline" onClick={()=> setAbgOpen(true)}>
                          Abrir Antibiograma
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(resultsData[studyItem.id] && resultsData[studyItem.id].length > 0) ? (
                      resultsData[studyItem.id].map((param, paramIndex) => {
                        const resultStatus = param.valor ? evaluateResult(param.valor, param, patient, patientAgeData) : 'no-evaluable';
                        const inputClasses = cn(
                          "md:col-span-1 bg-white/80 dark:bg-slate-700/80",
                          {
                            "border-red-500 focus-visible:ring-red-500": resultStatus === 'bajo' || resultStatus === 'alto' || resultStatus === 'invalido-alfanumerico',
                            "border-yellow-500 focus-visible:ring-yellow-500": resultStatus === 'no-numerico',
                          }
                        );
                        return (
                          <div key={`${studyItem.id}-${param.parametroId}-${paramIndex}`} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center border-b dark:border-slate-700 pb-3 last:border-b-0 last:pb-0">
                            <Label htmlFor={`result-${studyItem.id}-${paramIndex}`} className="text-sm md:col-span-1">
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
                            <p className="text-xs text-muted-foreground md:col-span-2">
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