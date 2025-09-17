import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import AIReportContent from './AIReportContent';
import { useSettings } from '@/contexts/SettingsContext';

const AIRecommendationsPreviewModal = ({ isOpen, onOpenChange, order, patient, recommendations }) => {
    const printRef = useRef();
    const { settings } = useSettings();

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Recomendaciones-IA-${order?.folio || 'reporte'}`,
        onAfterPrint: () => onOpenChange(false),
    });

    if (!recommendations) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl bg-slate-50 dark:bg-slate-900 max-h-[95vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Previsualización del Reporte de IA</DialogTitle>
                    <DialogDescription>
                        Así se verá el reporte de recomendaciones. Haz clic en imprimir para continuar.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-hidden">
                    <ScrollArea className="h-full pr-4">
                        <div className="p-4 border rounded-md bg-white shadow-inner">
                            <AIReportContent
                                ref={printRef}
                                labInfo={settings.labInfo}
                                order={order}
                                patient={patient}
                                recommendations={recommendations}
                            />
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="flex-shrink-0 pt-4">
                    <Button onClick={handlePrint} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                    <DialogClose asChild>
                        <Button variant="outline" className="w-full sm:w-auto">Cancelar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AIRecommendationsPreviewModal;