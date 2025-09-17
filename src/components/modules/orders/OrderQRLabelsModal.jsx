import React from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import QRCode from 'qrcode.react';
    import { Printer, QrCode as QrCodeIcon, User, CalendarDays } from 'lucide-react';
    import { useToast } from "@/components/ui/use-toast";
    import { formatInTimeZone } from '@/lib/dateUtils';

    const OrderQRLabelsModal = ({ isOpen, onOpenChange, order, patient }) => {
      const { toast } = useToast();

      if (!order || !patient) return null;

      const qrValue = `Orden: ${order.folio}\nPaciente: ${patient?.full_name || 'N/A'}\nFecha: ${formatInTimeZone(order.order_date, "dd/MM/yyyy")}`;

      const handlePrintLabels = () => {
        toast({
          title: "🚧 Imprimir Etiquetas QR",
          description: "La función de impresión de etiquetas aún no está implementada. ¡Podrás solicitarla pronto! 🚀",
        });
      };

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md bg-slate-50 dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="text-sky-700 dark:text-sky-400 flex items-center">
                <QrCodeIcon className="h-6 w-6 mr-2 text-teal-500" />
                Etiquetas QR para Orden: {order.folio}
              </DialogTitle>
              <DialogDescription>
                Código QR para identificación rápida de la orden y muestras.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <div className="p-4 border rounded-lg dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md">
                <QRCode value={qrValue} size={200} level="H" />
              </div>
              <div className="text-center text-sm text-slate-700 dark:text-slate-300 space-y-1">
                <p className="flex items-center justify-center"><User className="h-4 w-4 mr-1 text-sky-500" /> <strong>Paciente:</strong> {patient?.full_name || 'N/A'}</p>
                <p><strong>Folio:</strong> {order.folio}</p>
                <p className="flex items-center justify-center"><CalendarDays className="h-4 w-4 mr-1 text-sky-500" /> <strong>Fecha:</strong> {formatInTimeZone(order.order_date, "dd/MM/yyyy")}</p>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Contenido del QR: {qrValue.replace(/\n/g, ' | ')}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handlePrintLabels} className="w-full sm:w-auto">
                <Printer className="mr-2 h-4 w-4" /> Imprimir Etiquetas
              </Button>
              <DialogClose asChild>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cerrar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default OrderQRLabelsModal;