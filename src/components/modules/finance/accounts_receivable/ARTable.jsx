import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { CreditCard, Send, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const ARTable = ({
  orders,
  getPatientName,
  getReferrerName,
  getPatientPhone,
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
    const msg = filterStatus === 'pending'
      ? 'No hay cuentas por cobrar pendientes en el rango seleccionado.'
      : filterStatus === 'paid'
        ? 'No hay órdenes pagadas en el rango seleccionado.'
        : 'No se encontraron órdenes que coincidan con los filtros.';
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <AlertCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
        <p>{msg}</p>
        <p className="text-xs mt-2">Ajusta fechas o filtros para ver otros resultados.</p>
      </div>
    );
  }

  const sanitizePhoneForWhatsApp = (phone) => {
    if (!phone) return null;
    const trimmed = String(phone).trim();
    const cleaned = trimmed.replace(/[^+\d]/g, '');
    if (!cleaned) return null;
    // Si no hay + y parece local MX de 10 dígitos, anteponer +52
    if (!cleaned.startsWith('+') && cleaned.length === 10) return `+52${cleaned}`;
    return cleaned;
  };

  const buildWhatsAppUrl = (phone, text) => {
    const num = sanitizePhoneForWhatsApp(phone);
    if (!num) return null;
    const msg = encodeURIComponent(text || 'Hola');
    return `https://wa.me/${num.replace('+','') }?text=${msg}`;
  };

  const handleSendWhatsApp = (order) => {
    const phone = getPatientPhone(order.patient_id);
    const wurl = buildWhatsAppUrl(phone, `Hola ${getPatientName(order.patient_id)}, te escribimos de LabG40. Tienes un saldo pendiente de ${(() => { const n = parseFloat(order.balance); return Number.isFinite(n)? n.toFixed(2): '0.00'; })()} MXN de la orden ${order.folio}.`);
    if (!wurl) return alert('No se encontró un teléfono válido para WhatsApp.');
    window.open(wurl, '_blank', 'noopener,noreferrer');
  };

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
              <TableCell>{order.patient_name || getPatientName(order.patient_id)}</TableCell>
              <TableCell>{order.referrer_name || getReferrerName(order.referring_entity_id)}</TableCell>
              <TableCell className="text-right">{(() => { const n = parseFloat(order.total_price); return Number.isFinite(n)? n.toFixed(2): '0.00'; })()}</TableCell>
              <TableCell className="text-right text-green-600 dark:text-green-400">{(() => { const n = parseFloat(order.paid_amount); return Number.isFinite(n)? n.toFixed(2): '0.00'; })()}</TableCell>
              <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">{(() => { const n = parseFloat(order.balance); return Number.isFinite(n)? n.toFixed(2): '0.00'; })()}</TableCell>
              <TableCell className="text-center space-x-1">
                <Button variant="outline" size="sm" onClick={() => onOpenPaymentModal(order)} disabled={order.balance <= 0}>
                  <CreditCard className="h-4 w-4 mr-1" /> Registrar Pago
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onSendReminder(order)} disabled={order.balance <= 0}>
                  <Send className="h-4 w-4 mr-1" /> Enviar Recordatorio
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleSendWhatsApp(order)} disabled={order.balance <= 0}>
                  {/* Reutilizamos el icono de Send para mantener dependencia ligera */}
                  <Send className="h-4 w-4 mr-1" /> WhatsApp
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
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{(() => { const n = parseFloat(totalPendingAmount); return Number.isFinite(n)? n.toFixed(2): '0.00'; })()} MXN</p>
          </div>
        )}
        {filterStatus !== 'pending' && (
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Pagado (en periodo):</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{(() => { const n = parseFloat(totalPaidAmountInPeriod); return Number.isFinite(n)? n.toFixed(2): '0.00'; })()} MXN</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ARTable;