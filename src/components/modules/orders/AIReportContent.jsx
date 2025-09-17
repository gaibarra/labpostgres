import React, { useMemo } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, HeartPulse } from 'lucide-react';
import { formatInTimeZone } from '@/lib/dateUtils';
import { useEvaluationUtils } from './report_utils/evaluationUtils.js';

const AIReportContent = React.forwardRef(({ labInfo, order, patient, recommendations }, ref) => {
    const { calculateAgeInUnits } = useEvaluationUtils();

    const patientAgeData = useMemo(() => {
        if (patient?.date_of_birth) {
            return calculateAgeInUnits(patient.date_of_birth);
        }
        return { ageYears: 0, unit: 'años' };
    }, [patient, calculateAgeInUnits]);

    if (!order || !patient || !recommendations) {
        return <div ref={ref}>Cargando contenido...</div>;
    }

    return (
        <div ref={ref} className="p-2 sm:p-4 text-black printable-area">
            <header className="border-b-2 border-slate-700 pb-4 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{labInfo?.name || 'Laboratorio Clínico'}</h1>
                        <p className="text-xs sm:text-sm text-slate-600">{labInfo?.address}</p>
                        <p className="text-xs sm:text-sm text-slate-600">Tel: {labInfo?.phone} | Email: {labInfo?.email}</p>
                    </div>
                    <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-sky-500"/>
                </div>
                <div className="mt-4 text-center">
                    <h2 className="text-lg sm:text-xl font-bold text-sky-700">Reporte de Recomendaciones del Asistente IA</h2>
                </div>
            </header>

            <section className="mb-6">
                <h3 className="text-base font-semibold border-b pb-1 mb-2">Información del Paciente</h3>
                <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-1 text-xs sm:text-sm">
                    <div><strong>Paciente:</strong> {patient.full_name}</div>
                    <div><strong>Edad:</strong> {patientAgeData.ageYears} {patientAgeData.unit}</div>
                    <div><strong>Folio:</strong> {order.folio}</div>
                    <div><strong>Sexo:</strong> {patient.sex}</div>
                    <div><strong>Fecha de Reporte:</strong> {formatInTimeZone(new Date(), "d 'de' MMMM 'de' yyyy")}</div>
                </div>
            </section>

            <main className="space-y-6">
                <div className="p-3 sm:p-4 rounded-lg bg-sky-50 border border-sky-200">
                     <h3 className="font-bold text-base sm:text-lg flex items-center text-sky-800"><Sparkles className="h-5 w-5 mr-2"/>Resumen General</h3>
                     <p className="mt-2 text-xs sm:text-sm text-slate-700">{recommendations.summary}</p>
                </div>
               
                {recommendations.outOfRangeRecommendations?.length > 0 && (
                    <div className="p-3 sm:p-4 rounded-lg bg-amber-50 border border-amber-200">
                        <h3 className="font-bold text-base sm:text-lg flex items-center text-amber-800"><AlertTriangle className="h-5 w-5 mr-2"/>Resultados a Revisar</h3>
                        <div className="mt-3 space-y-4">
                        {recommendations.outOfRangeRecommendations.map((item, index) => (
                            <div key={index} className="border-t pt-3 first:border-t-0 first:pt-0">
                                <p className="font-semibold text-amber-900">{item.parameterName}: <span className="font-normal">{item.result}</span></p>
                                <p className="text-xs sm:text-sm mt-1 text-slate-600">{item.explanation}</p>
                                <ul className="list-disc list-inside text-xs sm:text-sm mt-2 text-slate-700 space-y-1 pl-4">
                                    {item.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                                </ul>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
                
                {recommendations.inRangeComments?.length > 0 && (
                     <div className="p-3 sm:p-4 rounded-lg bg-green-50 border border-green-200">
                        <h3 className="font-bold text-base sm:text-lg flex items-center text-green-800"><CheckCircle2 className="h-5 w-5 mr-2"/>Resultados en Rango Saludable</h3>
                        <div className="mt-3 space-y-2">
                        {recommendations.inRangeComments.map((item, index) => (
                            <div key={index} className="border-t pt-2 first:border-t-0 first:pt-0">
                                <p className="font-semibold text-green-900">{item.parameterName}</p>
                                <p className="text-xs sm:text-sm mt-1 text-slate-600">{item.comment}</p>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
            </main>

            <footer className="mt-8 pt-4 border-t-2 border-slate-700">
                <div className="p-3 sm:p-4 rounded-lg bg-slate-100">
                    <h4 className="font-bold text-sm sm:text-base flex items-center text-slate-800"><HeartPulse className="h-5 w-5 mr-2"/>Aviso Importante</h4>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2">{recommendations.finalDisclaimer}</p>
                </div>
                <p className="text-center text-[10px] sm:text-xs text-slate-500 mt-4">
                   Este es un reporte generado automáticamente.
                </p>
            </footer>
        </div>
    );
});

export default AIReportContent;