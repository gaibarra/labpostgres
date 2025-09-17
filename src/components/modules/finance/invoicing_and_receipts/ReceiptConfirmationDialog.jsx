import React from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
    import { Button } from '@/components/ui/button';
    import { Loader2, Eye } from 'lucide-react';
    import { format, isValid } from 'date-fns';

    const ReceiptConfirmationDialog = ({ isOpen, onOpenChange, selectedOrder, onConfirm, isLoading }) => {
      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-lg bg-slate-50 dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="text-sky-700 dark:text-sky-400 text-xl">Confirmar Generación de Recibo</DialogTitle>
              <DialogDescription>
                Se generará un recibo en PDF para la orden: <strong>{selectedOrder?.folio}</strong>.
                Este recibo no tiene validez fiscal como CFDI.
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="py-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <p><strong>Paciente:</strong> {selectedOrder.patient?.full_name || 'N/A'}</p>
                <p><strong>Fecha Orden:</strong> {isValid(selectedOrder.fecha) ? format(selectedOrder.fecha, 'dd/MM/yyyy') : 'Fecha Inválida'}</p>
                <p><strong>Total Orden:</strong> {(selectedOrder.total_price || 0).toFixed(2)} MXN</p>
              </div>
            )}
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
              <Button 
                onClick={() => onConfirm(selectedOrder)} 
                className="bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                {isLoading ? 'Generando...' : 'Generar y Previsualizar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default ReceiptConfirmationDialog;