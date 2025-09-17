import React, { useRef } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import { useReactToPrint } from 'react-to-print';
    import { Printer, Mail, Share2, QrCode } from 'lucide-react';
    import { useToast } from "@/components/ui/use-toast";
    import { OrderReceipt } from './OrderReceipt';

    const OrderPreviewModal = ({ isOpen, onOpenChange, order, patient, referrer, studiesDetails, packagesData, onOpenLabelsPreview }) => {
      const { toast } = useToast();
      const componentRef = useRef();

      const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Comprobante_Orden_${order?.folio || 'N_A'}`,
      });

      const handleShareFeature = () => {
        toast({
          title: "🚧 Función no implementada",
          description: "La opción de compartir por correo o enlace estará disponible próximamente. 🚀",
        });
      };
      
      const handleOpenLabels = () => {
        onOpenChange(false);
        onOpenLabelsPreview(order);
      }

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
            <DialogFooter className="flex-col sm:flex-row justify-between w-full">
              <div className="flex flex-col sm:flex-row gap-2">
                 <Button variant="outline" onClick={handleShareFeature}>
                  <Mail className="mr-2 h-4 w-4" /> Enviar por Correo
                </Button>
                <Button variant="outline" onClick={handleShareFeature}>
                  <Share2 className="mr-2 h-4 w-4" /> Compartir Enlace
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={handleOpenLabels}>
                  <QrCode className="mr-2 h-4 w-4" /> Imprimir Etiquetas
                </Button>
                <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                  <Printer className="mr-2 h-4 w-4" /> Imprimir Comprobante
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default OrderPreviewModal;