import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const PaymentModal = ({ 
  isOpen, 
  onOpenChange, 
  currentPayment, 
  onPaymentInputChange, 
  onPaymentDateChange, 
  onSubmitPayment,
  isLoading
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-50 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-blue-700 dark:text-blue-400 text-xl">Registrar Pago para Orden: {currentPayment.orderFolio}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmitPayment} className="space-y-4 py-4">
          <div>
            <label htmlFor="paymentDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de Pago</label>
            <Input type="date" id="paymentDate" name="paymentDate" 
                   value={currentPayment.paymentDate instanceof Date && isValid(currentPayment.paymentDate) ? format(currentPayment.paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')} 
                   onChange={(e) => onPaymentDateChange(parseISO(e.target.value))} 
                   className="bg-white dark:bg-slate-800" disabled={isLoading} />
          </div>
          <div>
            <label htmlFor="paymentAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto del Pago (MXN)</label>
            <Input type="number" step="0.01" id="paymentAmount" name="paymentAmount" value={currentPayment.paymentAmount} onChange={onPaymentInputChange} placeholder="0.00" className="bg-white dark:bg-slate-800" required disabled={isLoading} />
          </div>
          <div>
            <label htmlFor="paymentNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas (Opcional)</label>
            <Input id="paymentNotes" name="paymentNotes" value={currentPayment.paymentNotes} onChange={onPaymentInputChange} placeholder="Ej: Transferencia bancaria" className="bg-white dark:bg-slate-800" disabled={isLoading} />
          </div>
          <DialogFooter className="pt-4">
            <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button type="submit" className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
              {isLoading ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;