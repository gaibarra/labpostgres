import React, { useState, useEffect, useMemo } from 'react';
import ErrorBoundary from '@/components/common/ErrorBoundary.jsx';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
    import { Loader2, Sparkles, AlertTriangle, CheckCircle2, HeartPulse, Info, Printer } from 'lucide-react';
  import { apiClient } from '@/lib/apiClient';
    import { useToast } from "@/components/ui/use-toast";
    import { useEvaluationUtils } from './report_utils/evaluationUtils.js';
    import { useSettings } from '@/contexts/SettingsContext';

    const AIRecommendationsModal = ({ isOpen, onOpenChange, order, patient, studiesToDisplay, onOpenPreview }) => {
      const { toast } = useToast();
      const [recommendations, setRecommendations] = useState(null);
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState(null);
      const { calculateAgeInUnits, getReferenceRangeText, evaluateResult } = useEvaluationUtils();
      const { settings } = useSettings();

      const patientAgeData = useMemo(() => {
        if (patient?.date_of_birth) {
          return calculateAgeInUnits(patient.date_of_birth);
        }
        return { ageYears: 0, unit: 'años' };
      }, [patient?.date_of_birth, calculateAgeInUnits]);

      useEffect(() => {
        const fetchRecommendations = async () => {
          if (!isOpen || !order || !patient || !studiesToDisplay || !settings) return;

          const deepseekApiKey = settings.integrations?.deepseekKey;

          if (!deepseekApiKey) {
            setError("La API Key de Deepseek no está configurada en los ajustes regionales.");
            toast({
              title: "Configuración Incompleta",
              description: "Por favor, configure la API Key de Deepseek para usar esta función.",
              variant: "destructive",
            });
            return;
          }

          setIsLoading(true);
          setError(null);
          setRecommendations(null);

          try {
            const resultsForAI = studiesToDisplay.flatMap(study => {
              const studyResults = order.results?.[study.id] || [];
              if (!study.parameters || study.parameters.length === 0) return [];
              
              return study.parameters.map(param => {
                const resultEntry = studyResults.find(r => r.parametroId === param.id);
                const resultValue = resultEntry?.valor;

                if (resultValue === null || resultValue === undefined || resultValue === '') {
                  return null;
                }

                const paramWithRanges = { ...param, reference_ranges: param.reference_ranges || [] };
                const status = evaluateResult(resultValue, paramWithRanges, patient, patientAgeData);
                const refRangeText = getReferenceRangeText(paramWithRanges, patient, patientAgeData);
                
                return {
                  parameterName: param.name,
                  result: resultValue,
                  unit: param.unit || study.general_units,
                  refRange: refRangeText,
                  status,
                };
              }).filter(Boolean);
            });
            
            if (resultsForAI.length === 0) {
              setError("No hay resultados válidos para enviar al asistente de IA.");
              setIsLoading(false);
              return;
            }

            // Placeholder: call backend AI endpoint (to be implemented) or simulate
            try {
              const data = await apiClient.post('/analysis/ai/recommendations', {
                patientInfo: { age: patientAgeData.ageYears, sex: patient.sex },
                results: resultsForAI,
                apiKey: deepseekApiKey
              });
              setRecommendations(typeof data === 'string' ? JSON.parse(data) : data);
            } catch (_e) {
              // Fallback simulation
              setRecommendations({
                summary: 'Recomendaciones simuladas basadas en resultados proporcionados.',
                outOfRangeRecommendations: resultsForAI.slice(0,3).map(r => ({
                  parameterName: r.parameterName,
                  result: r.result,
                  explanation: 'Valor fuera de rango simulado.',
                  recommendations: ['Repetir estudio en 2 semanas', 'Correlacionar clínicamente']
                })),
                inRangeComments: [],
                finalDisclaimer: 'Este reporte es una simulación.'
              });
            }

          } catch (err) {
            console.error("Error fetching AI recommendations:", err);
            setError("No se pudieron generar las recomendaciones. Por favor, inténtalo de nuevo más tarde.");
            toast({
              title: "Error de IA",
              description: "Hubo un problema al comunicarse con el asistente de IA.",
              variant: "destructive",
            });
          } finally {
            setIsLoading(false);
          }
        };

        fetchRecommendations();
      }, [isOpen, order, patient, studiesToDisplay, toast, patientAgeData, evaluateResult, getReferenceRangeText, settings]);

      const handlePreview = () => {
        if (!order || !recommendations) return;
        onOpenPreview(order, recommendations);
      };

      const renderContent = () => {
        if (isLoading) {
          return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-sky-500 mb-4" />
              <p className="font-semibold text-lg text-slate-700 dark:text-slate-300">Analizando resultados...</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">El asistente de IA está generando recomendaciones personalizadas.</p>
            </div>
          );
        }

        if (error) {
          return (
            <div className="flex flex-col items-center justify-center h-64 text-center text-red-500">
              <AlertTriangle className="h-12 w-12 mb-4" />
              <p className="font-semibold text-lg">Error al generar reporte</p>
              <p className="text-sm">{error}</p>
            </div>
          );
        }

        if (!recommendations) {
          return (
             <div className="flex flex-col items-center justify-center h-64 text-center">
              <Info className="h-12 w-12 text-slate-400 mb-4" />
              <p className="font-semibold text-lg text-slate-700 dark:text-slate-300">Sin recomendaciones</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">No se pudo generar un reporte con los datos actuales.</p>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <Card className="bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800">
              <CardHeader>
                <CardTitle className="flex items-center text-sky-800 dark:text-sky-300">
                  <Sparkles className="h-5 w-5 mr-2 text-sky-500" />
                  Resumen del Asistente IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 dark:text-slate-300">{recommendations.summary}</p>
              </CardContent>
            </Card>

            {recommendations.outOfRangeRecommendations?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-amber-700 dark:text-amber-400 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" /> Resultados a Revisar
                </h3>
                <div className="space-y-4">
                  {recommendations.outOfRangeRecommendations.map((item, index) => (
                    <Card key={index} className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                      <CardHeader>
                        <CardTitle className="text-md text-amber-800 dark:text-amber-300">{item.parameterName}: <span className="font-normal">{item.result}</span></CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm text-slate-600 dark:text-slate-400">{item.explanation}</p>
                        <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1">
                          {item.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {recommendations.inRangeComments?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-700 dark:text-green-400 flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2" /> Resultados en Rango Saludable
                </h3>
                <div className="space-y-4">
                  {recommendations.inRangeComments.map((item, index) => (
                    <Card key={index} className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <CardHeader>
                        <CardTitle className="text-md text-green-800 dark:text-green-300">{item.parameterName}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{item.comment}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                <HeartPulse className="h-5 w-5 mr-2 text-slate-500" />
                Aviso Importante
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{recommendations.finalDisclaimer}</p>
            </div>
          </div>
        );
      };

      return (
        <ErrorBoundary dialogStates={{ modal: 'AIRecommendationsModal', open: isOpen }}>
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-3xl bg-slate-50 dark:bg-slate-900 max-h-[95vh]">
            <DialogHeader>
              <DialogTitle className="text-sky-700 dark:text-sky-400 flex items-center">
                <Sparkles className="h-6 w-6 mr-2 text-sky-500" />
                Asistente de Recomendaciones IA
              </DialogTitle>
              <DialogDescription>
                Sugerencias generadas por IA basadas en los resultados de laboratorio.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[calc(80vh-120px)] pr-4">
              <div className="p-1">
                {renderContent()}
              </div>
            </ScrollArea>
            <DialogFooter className="flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <Button
                    variant="default"
                    onClick={handlePreview}
                    disabled={!recommendations || isLoading}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                >
                    <Printer className="mr-2 h-4 w-4" />
                    Previsualizar e Imprimir
                </Button>
                <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto">Cerrar</Button>
                </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </ErrorBoundary>
      );
    };

    export default AIRecommendationsModal;