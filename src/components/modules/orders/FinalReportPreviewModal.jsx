// ...existing code...
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import autoTable from 'jspdf-autotable';
// ...existing code...
import React, { useMemo, useState } from 'react';
import { useResultWorkflow } from './hooks/useResultWorkflow.js';
import ErrorBoundary from '@/components/common/ErrorBoundary.jsx';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
    import { CheckSquare } from 'lucide-react';
    import { useToast } from "@/components/ui/use-toast";
    import { useEvaluationUtils } from './report_utils/evaluationUtils.js';
    import ReportHeader from './report_utils/ReportHeader.jsx';
    import ReportStudySection from './report_utils/ReportStudySection.jsx';
    import ReportFooter from './report_utils/ReportFooter.jsx';
    import { logAuditEvent } from '@/lib/auditUtils';
    import { generatePdfContent } from './report_utils/pdfGenerator.js';
    import { useOrderManagement } from './hooks/useOrderManagement.js';
    import { useSettings } from '@/contexts/SettingsContext';
    import AIRecommendationsModal from './AIRecommendationsModal.jsx';

    const FinalReportPreviewModal = ({ isOpen, onOpenChange, order, patient, referrer, studiesDetails, packagesData, onSend }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  // const [aiPreview, setAIPreview] = useState({ order: null, recommendations: null }); // (unused currently)
  const [isAIPreviewOpen, setIsAIPreviewOpen] = useState(false);
      const { toast } = useToast();
      const { settings: labSettings } = useSettings();
      const { calculateAgeInUnits, getReferenceRangeText, evaluateResult } = useEvaluationUtils();
      const { getStudiesAndParametersForOrder } = useOrderManagement();
      const [isAIModalOpen, setIsAIModalOpen] = useState(false);


      const patientAgeData = useMemo(() => {
        if (patient?.date_of_birth) {
          return calculateAgeInUnits(patient.date_of_birth);
        }
        return { ageYears: 0, unit: 'años', fullMonths: 0, fullDays: 0, fullWeeks: 0, fullHours: 0 };
      }, [patient?.date_of_birth, calculateAgeInUnits]);

      const studiesToDisplayInReport = useMemo(() => {
        if (!order || !studiesDetails || !packagesData) return [];
        return getStudiesAndParametersForOrder(order.selected_items, studiesDetails, packagesData);
      }, [order, studiesDetails, packagesData, getStudiesAndParametersForOrder]);

          // (debug eliminado: consola de resultados del reporte)
      // Snapshot conciso al montar/abrir (limpia logs anteriores ruidosos)
  const wf = useResultWorkflow();


      if (!order || !patient || !labSettings) return null;

      const cleanNumericValueForStorage = (value) => {
        if (value === '' || value === undefined || value === null) return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      };

      const handleGeneratePDF = () => {
        try {
          generatePdfContent(
            order,
            patient,
            referrer,
            studiesDetails, 
            packagesData,
            patientAgeData,
            labSettings,
            getReferenceRangeText,
            evaluateResult,
            cleanNumericValueForStorage,
            getStudiesAndParametersForOrder
          );
          toast({ title: "Reporte Generado", description: "El PDF del reporte se está abriendo en una nueva pestaña." });
          logAuditEvent('ReportePDFGenerado', { orderId: order.id, patientId: patient.id }, order.createdBy || 'Sistema');
        } catch (error) {
          console.error("Error al generar el PDF:", error);
          toast({
            title: "Error al generar PDF",
            description: "Hubo un problema al crear el reporte. Por favor, intente de nuevo.",
            variant: "destructive",
          });
        }
      };

      const handleSendAction = (platform) => {
        const labName = labSettings.labInfo?.name || "Laboratorio Clínico Horizonte";
        const reportSummary = `Resultados de Laboratorio - ${labName}\nFolio: ${order.folio}\nPaciente: ${patient.full_name}`;
        const reminder = `\n\nIMPORTANTE: Recuerde generar el PDF del reporte desde la previsualización y adjuntarlo a este mensaje antes de enviar.`;
        
        if (platform === 'Email') {
          const subject = `Resultados de Laboratorio - ${patient.full_name} - Folio ${order.folio}`;
          const body = `Estimado(a) ${patient.full_name},\n\n${reportSummary}\n\nPor favor, genere el PDF desde la previsualización y adjúntelo a este correo antes de enviar.\n\nSaludos cordiales,\n${labName}`;
          const mailtoLink = `mailto:${patient.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          window.location.href = mailtoLink;
          toast({
            title: "Preparando Email",
            description: "Se ha abierto su cliente de correo. Por favor, adjunte el PDF generado antes de enviar.",
            duration: 7000,
          });
          logAuditEvent('ReporteEnviadoIntento', { orderId: order.id, platform: 'Email' }, order.createdBy || 'Sistema');
        } else if (platform === 'Telegram') {
          const telegramMessage = `Estimado(a) ${patient.full_name},\n${reportSummary}${reminder}\n\nSaludos cordiales,\n${labName}`;
          let telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(reportSummary)}&text=${encodeURIComponent(telegramMessage)}`;
          
          if (patient.phone_number) {
            let phoneNumber = patient.phone_number.replace(/\D/g, ''); 
            if (phoneNumber) {
               telegramUrl = `tg://msg_url?url=${encodeURIComponent(reportSummary)}&text=${encodeURIComponent(telegramMessage)}&to=+${phoneNumber}`;
            }
          }
          window.open(telegramUrl, '_blank');
          toast({
            title: "Preparando envío por Telegram",
            description: "Se intentará abrir Telegram. Por favor, adjunte el PDF y complete el envío.",
            duration: 7000,
          });
          logAuditEvent('ReporteEnviadoIntento', { orderId: order.id, platform: 'Telegram' }, order.createdBy || 'Sistema');
        } else if (platform === 'WhatsApp') {
          const whatsappMessage = `Estimado(a) ${patient.full_name},\n${reportSummary}${reminder}\n\nSaludos cordiales,\n${labName}`;
          let whatsappUrl = `https://wa.me/`;
          if (patient.phone_number) {
            const phoneNumber = patient.phone_number.replace(/\D/g, '');
            if (phoneNumber) {
              whatsappUrl += `${phoneNumber}`;
            }
          }
          whatsappUrl += `?text=${encodeURIComponent(whatsappMessage)}`;
          
          window.open(whatsappUrl, '_blank');
          toast({
            title: "Preparando envío por WhatsApp",
            description: "Se intentará abrir WhatsApp. Por favor, adjunte el PDF y complete el envío.",
            duration: 7000,
          });
          logAuditEvent('ReporteEnviadoIntento', { orderId: order.id, platform: 'WhatsApp' }, order.createdBy || 'Sistema');
        } else {
          onSend(platform, order, patient);
          toast({
            title: `🚧 Enviar por ${platform}`,
            description: `La función para enviar por ${platform} aún no está implementada. ¡Podrás solicitarla pronto! 🚀`,
          });
        }
      };

      return (
        <ErrorBoundary dialogStates={{ modal: 'FinalReportPreviewModal', open: isOpen, aiModal: isAIModalOpen, aiPreview: isAIPreviewOpen }}>
        <>
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent
            className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl bg-slate-50 dark:bg-slate-900 max-h-[95vh] flex flex-col p-0"
            aria-describedby="pdf-preview-description"
          >
            <DialogDescription id="pdf-preview-description">
              Previsualización del PDF generado para el paciente. Revisa el contenido antes de descargar.
            </DialogDescription>
            <DialogHeader className="p-6 pb-0 shrink-0">
              <DialogTitle className="text-sky-700 dark:text-sky-400 flex items-center">
                <CheckSquare className="h-7 w-7 mr-2 text-sky-500" />
                Reporte: {order.folio} {order.status && <span className="ml-3 text-xs font-medium px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-800/40 text-sky-700 dark:text-sky-300">{order.status}{order.results_finalized ? ' ✓' : ''}</span>}
              </DialogTitle>
              <DialogDescription>
                Revise cuidadosamente los resultados finales antes de generar o enviar el reporte.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 min-h-0 overflow-y-auto px-6">
              <div className="p-4 md:p-6 space-y-6 printable-content bg-white dark:bg-slate-800/30 rounded-lg shadow-xl border dark:border-slate-700 my-4">
                <ReportHeader 
                  labInfo={labSettings.labInfo}
                  order={order}
                  patient={patient}
                  referrer={referrer}
                  patientAgeData={patientAgeData}
                />

                {studiesToDisplayInReport.map(studyDetail => {
                  if (!studyDetail) return null;
                  
                  const cleanedStudyDetail = {
                    ...studyDetail,
                    parameters: (studyDetail.parameters || []).map(p => ({
                      ...p,
                      valorReferencia: (p.valorReferencia || []).map(vr => ({
                          ...vr,
                          edadMin: cleanNumericValueForStorage(vr.edadMin),
                          edadMax: cleanNumericValueForStorage(vr.edadMax),
                          valorMin: cleanNumericValueForStorage(vr.valorMin),
                          valorMax: cleanNumericValueForStorage(vr.valorMax),
                          unidadEdad: vr.unidadEdad || 'años',
                      }))
                    }))
                  };
                  
                  // INTENTO PRINCIPAL: usar la key exacta del estudio
                  let directResults = order.results?.[studyDetail.id] || order.results?.[String(studyDetail.id)] || [];
                  const allResultKeys = Object.keys(order.results || {});
                  let usedFallback = false;
                  // FALLBACK: si no hay resultados directos pero sí existen otras keys, intentar localizar por parametroId
                  if ((!directResults || directResults.length === 0) && allResultKeys.length > 0) {
                    // Aplanar todas las entradas y filtrar por parámetros pertenecientes a este estudio
                    const flat = allResultKeys.flatMap(k => Array.isArray(order.results[k]) ? order.results[k] : []);
                    const paramIdsSet = new Set((studyDetail.parameters || []).map(p => String(p.id)));
                    const matched = flat.filter(r => paramIdsSet.has(String(r.parametroId)));
                    if (matched.length) {
                      directResults = matched;
                      usedFallback = true;
                    }
                  }
                  if (typeof window !== 'undefined') {
                    try { console.debug('[REPORT][STUDY]', { id: studyDetail.id, name: studyDetail.name, finalCount: directResults.length, usedFallback }); } catch (e) { /* ignore log error */ }
                  }
                  const currentOrderResults = directResults;

                  return (
                    <ReportStudySection
                      key={`report-study-${studyDetail.id}`}
                      studyDetail={cleanedStudyDetail}
                      orderResults={currentOrderResults}
                      patient={patient}
                      getReferenceRangeText={getReferenceRangeText}
                      evaluateResult={evaluateResult}
                      patientAgeData={patientAgeData}
                    />
                  );
                })}

                {order.validation_notes && (
                  <div className="mt-6 pt-4 border-t dark:border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Notas de Validación / Observaciones:</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{order.validation_notes}</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="bg-slate-50 dark:bg-slate-900 p-6 border-t dark:border-slate-700 shrink-0">
               <div className="flex w-full justify-between items-center">
                 <div className="flex gap-2">
                   {(order.status === 'Reportada' || order.status === 'Entregada') && (
                     <Button type="button" variant="outline" size="sm" onClick={async ()=>{
                       try {
                         await wf.reopenForCorrection(order.id);
                         toast({ title: 'Orden Reabierta', description: 'Estado cambiado a Procesando para corrección.' });
                         onOpenChange(false);
                       } catch(e){ toast({ title: 'Error reabriendo', description: e.message, variant: 'destructive' }); }
                     }}>Reabrir para Corrección</Button>
                   )}
                 </div>
                 <ReportFooter 
                 order={order}
                 generatePDF={handleGeneratePDF}
                 handleSendAction={handleSendAction}
                 onOpenChange={onOpenChange}
                 onAIAssist={() => setIsAIModalOpen(true)}
                 />
               </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Montaje persistente de modales IA para evitar race de desmontaje de portales */}
        <AIRecommendationsModal
          isOpen={isAIModalOpen}
          onOpenChange={setIsAIModalOpen}
          order={order}
          patient={patient}
          studiesToDisplay={studiesToDisplayInReport}
          onOpenPreview={(order, recommendations) => {
            const doc = new jsPDF();
            let y = 20;
            doc.setFontSize(18);
            doc.text('Informe de Recomendaciones de Laboratorio', 15, y);
            y += 12;
            doc.setFontSize(12);
            if (recommendations?.summary) {
              doc.setTextColor(33, 150, 243);
              doc.text('Resumen del Asistente IA', 15, y);
              y += 7;
              doc.setTextColor(0,0,0);
              doc.text(doc.splitTextToSize(recommendations.summary, 180), 15, y);
              y += 12;
            }
            if (recommendations?.outOfRangeRecommendations?.length) {
              autoTable(doc, {
                startY: y,
                head: [['Resultados a Revisar', '', '', '']],
                body: recommendations.outOfRangeRecommendations.map(item => [
                  `${item.parameterName}: ${item.result}`,
                  item.explanation,
                  (item.recommendations || []).map(r => `• ${r}`).join('\n'),
                  `Estado: ${item.status}`
                ]),
                styles: { fillColor: [255, 236, 179], textColor: [0,0,0], halign: 'left', fontSize: 11 },
                headStyles: { fillColor: [255, 193, 7], textColor: [0,0,0], fontSize: 13 },
                columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 }, 3: { cellWidth: 20 } }
              });
              y = doc.lastAutoTable.finalY + 8;
            }
            if (recommendations?.inRangeComments?.length) {
              autoTable(doc, {
                startY: y,
                head: [['Resultados en Rango Saludable', '', '']],
                body: recommendations.inRangeComments.map(item => [
                  item.parameterName,
                  item.comment,
                  ''
                ]),
                styles: { fillColor: [200, 230, 201], textColor: [0,0,0], halign: 'left', fontSize: 11 },
                headStyles: { fillColor: [56, 142, 60], textColor: [255,255,255], fontSize: 13 },
                columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 70 }, 2: { cellWidth: 15 } }
              });
              y = doc.lastAutoTable.finalY + 8;
            }
            if (recommendations?.finalDisclaimer) {
              doc.setFontSize(10);
              doc.setTextColor(100,100,100);
              doc.text('Nota:', 15, y);
              y += 6;
              doc.text(doc.splitTextToSize(recommendations.finalDisclaimer, 180), 15, y);
              doc.setTextColor(0,0,0);
            }
            const pdfData = doc.output('blob');
            const url = URL.createObjectURL(pdfData);
            setPdfUrl(url);
            setIsAIPreviewOpen(true);
          }}
        />
        <Dialog open={isAIPreviewOpen} onOpenChange={(open) => {
          if (!open && pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
          }
          setIsAIPreviewOpen(open);
        }}>
          <DialogContent aria-describedby="ai-pdf-preview-description">
            <DialogHeader>
              <DialogTitle>Previsualización de Recomendaciones IA (PDF)</DialogTitle>
            </DialogHeader>
            <DialogDescription id="ai-pdf-preview-description">
              Visualiza el PDF generado por el asistente IA antes de descargarlo.
            </DialogDescription>
            <div style={{height: '70vh'}}>
              {pdfUrl ? (
                <iframe src={pdfUrl} title="Recomendaciones IA PDF" style={{width: '100%', height: '100%', border: 'none'}} />
              ) : (
                <p>No se pudo generar el PDF.</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => {
                setIsAIPreviewOpen(false);
                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
              }}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
        </ErrorBoundary>
      );
    };

    export default FinalReportPreviewModal;