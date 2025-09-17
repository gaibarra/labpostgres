import React, { useMemo, useRef, useState } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { useReactToPrint } from 'react-to-print';
    import { Printer, X } from 'lucide-react';
    import ReportHeader from '@/components/modules/orders/report_utils/ReportHeader';
    import { useOrderManagement } from './hooks/useOrderManagement';
    import { useEvaluationUtils } from './report_utils/evaluationUtils';
    import { Switch } from '@/components/ui/switch';
    import { Label } from '@/components/ui/label';
    import { cn } from '@/lib/utils';

    import { useSettings } from '@/contexts/SettingsContext';
    const WorkSheetModal = ({ isOpen, onClose, order, studiesDetails, packagesDetails, patientDetails }) => {
      const componentRef = useRef();
      const { settings } = useSettings();
      const { getStudiesAndParametersForOrder } = useOrderManagement();
      const { calculateAgeInUnits, getReferenceRangeText } = useEvaluationUtils();
      const [isCompactView, setIsCompactView] = useState(true);

      const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Hoja_de_Trabajo_${order?.folio || 'folio'}`,
      });

      const flattenedItems = useMemo(() => {
        if (!order || !order.selected_items || !studiesDetails || !packagesDetails) {
          return [];
        }
        return getStudiesAndParametersForOrder(order.selected_items, studiesDetails, packagesDetails);
      }, [order, studiesDetails, packagesDetails, getStudiesAndParametersForOrder]);

      const patientAgeData = useMemo(() => {
        if (patientDetails?.date_of_birth) {
          return calculateAgeInUnits(patientDetails.date_of_birth);
        }
        return { ageYears: 0, unit: 'años', fullMonths: 0, fullDays: 0 };
      }, [patientDetails?.date_of_birth, calculateAgeInUnits]);

  if (!isOpen || !order || !patientDetails) return null;
  const labInfo = settings?.labInfo || {};

      const StandardView = () => (
        <>
          {flattenedItems.map((study, index) => (
            <div key={study.id} className={`mt-3 break-inside-avoid ${index > 0 ? 'pt-3' : ''}`}>
              <h4 className="text-lg font-semibold text-center bg-sky-100 dark:bg-sky-900/50 py-1.5 rounded-t-lg text-sky-800 dark:text-sky-300">{study.name}</h4>
              <div className="border-x border-b rounded-b-lg p-2">
                {renderParametersInTwoColumns(study.parameters)}
              </div>
            </div>
          ))}
        </>
      );
      
      const renderParametersInTwoColumns = (parameters) => {
        if (!parameters || parameters.length === 0) {
          return <p className="text-sm text-center text-slate-500 p-4">Este estudio no tiene parámetros definidos.</p>;
        }
        const midPoint = Math.ceil(parameters.length / 2);
        const col1 = parameters.slice(0, midPoint);
        const col2 = parameters.slice(midPoint);

        return (
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              {col1.map((param, pIndex) => (
                <div key={pIndex} className="text-sm py-1 break-inside-avoid">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{param.name}:</span>
                  <div className="w-full h-4 border-b border-dotted border-slate-500 my-1"></div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Ref: {getReferenceRangeText(param, patientDetails, patientAgeData)}
                  </div>
                </div>
              ))}
            </div>
            <div>
              {col2.map((param, pIndex) => (
                <div key={pIndex} className="text-sm py-1 break-inside-avoid">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{param.name}:</span>
                  <div className="w-full h-4 border-b border-dotted border-slate-500 my-1"></div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                     Ref: {getReferenceRangeText(param, patientDetails, patientAgeData)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      };

      const CompactView = () => (
        <div className="columns-3 gap-x-6">
          {flattenedItems.map((study, index) => (
            <div key={study.id} className="break-inside-avoid mb-3">
              <h4 className="text-base font-semibold text-sky-800 dark:text-sky-300 py-1">{study.name}</h4>
              {study.parameters?.map((param, pIndex) => (
                <div key={pIndex} className="text-sm py-0.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{param.name}:</span>
                  <div className="w-full h-3 border-b border-dotted border-slate-500 mt-0.5"></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      );

      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b dark:border-slate-700">
              <div className="flex justify-between items-center">
                <div>
                  <DialogTitle className="text-2xl font-bold text-sky-700 dark:text-sky-400">Hoja de Trabajo - Folio: {order.folio}</DialogTitle>
                  <DialogDescription>Seleccione el formato de la hoja de trabajo.</DialogDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="compact-view-switch" className={cn("text-sm", !isCompactView && "text-sky-600 font-semibold")}>Estándar</Label>
                  <Switch
                    id="compact-view-switch"
                    checked={isCompactView}
                    onCheckedChange={setIsCompactView}
                  />
                  <Label htmlFor="compact-view-switch" className={cn("text-sm", isCompactView && "text-sky-600 font-semibold")}>Compacta</Label>
                </div>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-grow">
               <div className="p-6">
                <div ref={componentRef} className="print-friendly-worksheet">
                  <table className="w-full print-table">
                    <thead className="print-header">
                      <tr>
                        <td>
                          <div className="print-header-content">
                            <ReportHeader 
                              labInfo={labInfo}
                              order={order}
                              patient={patientDetails}
                              patientAgeData={patientAgeData}
                              isWorksheet={true}
                            />
                          </div>
                        </td>
                      </tr>
                    </thead>
                    <tbody className="print-body">
                      <tr>
                        <td>
                          <div className="printable-content pt-4">
                            {isCompactView ? <CompactView /> : <StandardView />}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="print-footer">
                      <tr>
                        <td>
                          <div className="print-footer-content"></div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
               </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900/50">
              <Button variant="outline" onClick={onClose} className="mr-auto">
                <X className="mr-2 h-4 w-4" /> Cerrar
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir / Guardar PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default WorkSheetModal;