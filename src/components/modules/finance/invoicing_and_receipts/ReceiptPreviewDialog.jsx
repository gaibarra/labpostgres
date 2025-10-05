import React from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import { Printer, Download } from 'lucide-react';
    import { triggerDownload } from '@/utils/safeDownload';

    const ReceiptPreviewDialog = ({ isOpen, onOpenChange, selectedOrder, pdfUrl, iframeRef }) => {
      
      const handlePrintReceipt = () => {
        if (iframeRef.current) {
          iframeRef.current.contentWindow.print();
        }
      };

      const handleDownloadReceipt = () => {
        if(!pdfUrl) return;
        triggerDownload(pdfUrl, `Recibo_Orden_${selectedOrder?.folio}.pdf`);
      };

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-slate-50 dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="text-sky-700 dark:text-sky-400 text-xl">Previsualización de Recibo</DialogTitle>
              <DialogDescription>
                Recibo para la orden: <strong>{selectedOrder?.folio}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow border rounded-md overflow-hidden">
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                title={`Recibo Orden ${selectedOrder?.folio}`}
                className="w-full h-full"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
              <Button onClick={handlePrintReceipt} className="bg-slate-600 hover:bg-slate-700 text-white">
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
              <Button onClick={handleDownloadReceipt} className="bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white">
                <Download className="mr-2 h-4 w-4" /> Descargar PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default ReceiptPreviewDialog;