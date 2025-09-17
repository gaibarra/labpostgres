import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { CreditCard, Send, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const ARTable = ({
  orders,
  getPatientName,
  getReferrerName,
  onOpenPaymentModal,
  onSendReminder,
  totalPendingAmount,
  totalPaidAmountInPeriod,
  filterStatus,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <AlertCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
        <p>No se encontraron órdenes que coincidan con los filtros.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Referente</TableHead>
            <TableHead className="text-right">Total Orden</TableHead>
            <TableHead className="text-right">Monto Pagado</TableHead>
            <TableHead className="text-right">Saldo Pendiente</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map(order => (
            <TableRow key={order.id}>
              <TableCell>{order.folio}</TableCell>
              <TableCell>{format(new Date(order.order_date), 'dd/MM/yyyy')}</TableCell>
              <TableCell>{getPatientName(order.patient_id)}</TableCell>
              <TableCell>{getReferrerName(order.referring_entity_id)}</TableCell>
              <TableCell className="text-right">{order.total_price.toFixed(2)}</TableCell>
              <TableCell className="text-right text-green-600 dark:text-green-400">{order.paid_amount.toFixed(2)}</TableCell>
              <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">{order.balance.toFixed(2)}</TableCell>
              <TableCell className="text-center space-x-1">
                <Button variant="outline" size="sm" onClick={() => onOpenPaymentModal(order)} disabled={order.balance <= 0}>
                  <CreditCard className="h-4 w-4 mr-1" /> Registrar Pago
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onSendReminder(order)} disabled={order.balance <= 0}>
                  <Send className="h-4 w-4 mr-1" /> Enviar Recordatorio
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex justify-end gap-6 pr-4">
        {filterStatus !== 'paid' && (
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Pendiente (filtrado):</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{totalPendingAmount.toFixed(2)} MXN</p>
          </div>
        )}
        {filterStatus !== 'pending' && (
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Pagado (en periodo):</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{totalPaidAmountInPeriod.toFixed(2)} MXN</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ARTable;