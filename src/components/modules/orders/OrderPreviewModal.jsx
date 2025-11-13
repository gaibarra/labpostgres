import React, { useRef } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import { useReactToPrint } from 'react-to-print';
    import { Printer } from 'lucide-react';
    import { useToast } from "@/components/ui/use-toast";
    import { OrderReceipt } from './OrderReceipt';

  const OrderPreviewModal = ({ isOpen, onOpenChange, order, patient, referrer, studiesDetails, packagesData }) => {
      const { toast } = useToast();
      const componentRef = useRef();

      const fallbackPrint = () => {
        try {
          const node = componentRef.current;
          if (!node) return;
          const title = `Comprobante_Orden_${order?.folio || 'N_A'}`;
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
          <style>
            html,body{background:#fff;color:#000;margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;}
            h1,h2,h3{margin:6px 0}
            table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #e5e7eb;padding:6px;font-size:12px}
            .text-right{text-align:right}
            .text-center{text-align:center}
            .border{border:1px solid #e5e7eb}
            .rounded{border-radius:6px}
          </style></head><body>${node.outerHTML}</body></html>`;
          const w = window.open('', '_blank');
          if (!w) {
            toast({ title: 'Vista previa bloqueada', description: 'Habilita popups para ver la vista previa o intenta de nuevo.', variant: 'destructive' });
            return;
          }
          w.document.open(); w.document.write(html); w.document.close();
          setTimeout(()=>{ try { w.focus(); w.print(); } catch(_) { /* ignore window print errors */ } }, 400);
        } catch (e) {
          toast({ title: 'No se pudo previsualizar', description: e.message || 'Error desconocido', variant: 'destructive' });
        }
      };

      const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Comprobante_Orden_${order?.folio || 'N_A'}`,
        pageStyle: `@page { size: auto; margin: 12mm } body { -webkit-print-color-adjust: exact; color-adjust: exact; }`,
        onPrintError: (_location, error) => {
          console.warn('[PRINT][react-to-print error]', error?.message || error);
          fallbackPrint();
        }
      });

  // share and labels features removed per request

      if (!order || !patient) return null;

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-4xl bg-slate-50 dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="text-sky-700 dark:text-sky-400">Comprobante de Orden</DialogTitle>
              <DialogDescription>
                Previsualización del comprobante para la orden {order.folio}.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 max-h-[65vh] overflow-y-auto p-2 border rounded-md bg-white">
              <OrderReceipt
                ref={componentRef}
                order={order}
                patient={patient}
                referrer={referrer}
                studiesDetails={studiesDetails}
                packagesData={packagesData}
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row justify-end w-full">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => {
                  let done = false;
                  const clear = () => { done = true; try { window.removeEventListener('afterprint', clear); } catch(_) { /* ignore removeEventListener errors */ } };
                  try { window.addEventListener('afterprint', clear); } catch(_) { /* ignore addEventListener errors */ }
                  const timer = setTimeout(()=>{ if (!done) { clearTimeout(timer); clear(); fallbackPrint(); } }, 1400);
                  try {
                    const r = handlePrint && handlePrint();
                    if (r && typeof r.then === 'function') {
                      r.finally(() => { clearTimeout(timer); clear(); });
                    }
                  } catch (e) {
                    clearTimeout(timer); clear(); fallbackPrint();
                  }
                }} className="bg-blue-600 hover:bg-blue-700">
                  <Printer className="mr-2 h-4 w-4" /> Imprimir Comprobante
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default OrderPreviewModal;