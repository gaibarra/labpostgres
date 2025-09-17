import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { logAuditEvent } from '@/lib/auditUtils';

const initialPaymentForm = {
  orderId: null,
  orderFolio: '',
  paymentAmount: '',
  paymentDate: new Date(),
  paymentNotes: '',
};

export const useAccountsReceivable = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [currentPayment, setCurrentPayment] = useState(initialPaymentForm);
  
  const [dateRange, setDateRange] = useState({ from: new Date(new Date().setDate(new Date().getDate() - 90)), to: new Date() });
  const [filterBy, setFilterBy] = useState('all'); 
  const [filterEntityId, setFilterEntityId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('pending');

  const loadBaseData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [patientsRes, referrersRes] = await Promise.all([
        apiClient.get('/patients?limit=1000').catch(e=>{ throw e; }),
        apiClient.get('/referrers?limit=1000').catch(e=>{ throw e; })
      ]);
      setPatients((patientsRes?.data||[]).map(p => ({ id: p.id, nombre: p.full_name, email: p.email })));
      setReferrers((referrersRes?.data||[]).map(r => ({ id: r.id, nombre: r.name })));
    } catch (error) {
      toast({ title: 'Error al cargar datos base', description: error.message, variant: 'destructive' });
    }
  }, [toast]);
  
  const loadOrdersWithBalance = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set('from', startOfDay(dateRange.from).toISOString());
      if (dateRange?.to) params.set('to', endOfDay(dateRange.to).toISOString());
      if (filterStatus) params.set('status', filterStatus);
      if (filterBy !== 'all' && filterEntityId !== 'all') {
        params.set('entityType', filterBy);
        params.set('entityId', filterEntityId);
      }
      const data = await apiClient.get(`/finance/receivables?${params.toString()}`);
      setOrders((data||[]).map(o => ({ ...o, fecha: parseISO(o.order_date) })));
    } catch (error) {
      toast({ title: 'Error al cargar órdenes', description: error.message, variant: 'destructive' });
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, dateRange, filterStatus, filterBy, filterEntityId]);

  useEffect(() => {
    loadBaseData().then(() => loadOrdersWithBalance());
  }, [loadBaseData, loadOrdersWithBalance]);

  const getPatientName = useCallback((patientId) => patients.find(p => p.id === patientId)?.nombre || 'N/A', [patients]);
  const getReferrerName = useCallback((referrerId) => referrers.find(r => r.id === referrerId)?.nombre || 'N/A', [referrers]);

  const handleOpenPaymentModal = (order) => {
    setCurrentPayment({
      orderId: order.id,
      orderFolio: order.folio,
      paymentAmount: order.balance.toFixed(2),
      paymentDate: new Date(),
      paymentNotes: '',
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentPayment(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentDateChange = (date) => {
    setCurrentPayment(prev => ({ ...prev, paymentDate: date || new Date() }));
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(currentPayment.paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Monto Inválido", description: "El monto del pago debe ser un número positivo.", variant: "destructive" });
      return;
    }

    const orderToUpdate = orders.find(o => o.id === currentPayment.orderId);
    if (!orderToUpdate) {
      toast({ title: "Error", description: "Orden no encontrada.", variant: "destructive" });
      return;
    }

    if (amount > orderToUpdate.balance + 0.001) {
      toast({ title: "Monto Excedido", description: `El pago no puede exceder el saldo pendiente de ${orderToUpdate.balance.toFixed(2)} MXN.`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const paymentData = {
      work_order_id: currentPayment.orderId,
      payment_date: currentPayment.paymentDate.toISOString(),
      amount: amount,
      notes: currentPayment.paymentNotes,
      user_id: user?.id,
    };

    try {
      await apiClient.post('/finance/payments', paymentData);
      toast({ title: 'Pago Registrado', description: `Se registró un pago de ${amount.toFixed(2)} MXN para la orden ${currentPayment.orderFolio}.` });
      logAuditEvent('Finanzas:PagoRegistrado', { orderId: currentPayment.orderId, amount });
      await loadOrdersWithBalance();
      setIsPaymentModalOpen(false);
      setCurrentPayment(initialPaymentForm);
    } catch (error) {
      toast({ title: 'Error al Registrar Pago', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSendReminder = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      toast({ title: "Error", description: "Orden no encontrada.", variant: "destructive" });
      return;
    }
    const patient = patients.find(p => p.id === order.patient_id);
    
    const patientEmail = patient?.email;
    const patientName = patient?.nombre || "Estimado/a Paciente";
    const orderFolio = order.folio;
    const balance = order.balance.toFixed(2);
    const laboratoryName = "Laboratorio Clínico LACLIS"; 

    if (patientEmail) {
      const subject = encodeURIComponent(`Recordatorio de Pago - Orden ${orderFolio} - ${laboratoryName}`);
      const body = encodeURIComponent(
`Estimado/a ${patientName},

Le recordamos amablemente que tiene un saldo pendiente de ${balance} MXN correspondiente a la orden de laboratorio N° ${orderFolio}.

Detalles de la orden:
Folio: ${orderFolio}
Fecha: ${format(parseISO(order.order_date), 'dd/MM/yyyy HH:mm')}
Total: ${order.total_price.toFixed(2)} MXN
Pagado: ${order.paid_amount.toFixed(2)} MXN
Saldo Pendiente: ${balance} MXN

Agradeceríamos si pudiera realizar el pago a la brevedad posible. Si ya realizó el pago, por favor ignore este mensaje.

Atentamente,
El equipo de ${laboratoryName}`
      );

      const mailtoLink = `mailto:${patientEmail}?subject=${subject}&body=${body}`;
      
      try {
        window.location.href = mailtoLink;
        toast({
          title: "Cliente de Correo Abierto",
          description: `Se ha preparado un borrador de correo para ${patientEmail}.`,
        });
      } catch (error) {
        toast({
          title: "Error al Abrir Cliente de Correo",
          description: "No se pudo abrir automáticamente el cliente de correo.",
          variant: "destructive",
        });
      }

    } else {
       toast({
        title: "Correo no Encontrado",
        description: `No se encontró correo electrónico para el paciente de la orden ${order.folio}.`,
        variant: "warning"
      });
    }
  };

  const filteredOrders = orders.filter(order => {
    const orderDate = parseISO(order.order_date);
    if (!isValid(orderDate)) return false;
    
    const fromDate = dateRange?.from ? startOfDay(dateRange.from) : null;
    const toDate = dateRange?.to ? endOfDay(dateRange.to) : null;
    
    if (fromDate && orderDate < fromDate) return false;
    if (toDate && orderDate > toDate) return false;

    if (filterEntityId !== 'all') {
      if (filterBy === 'patient' && order.patient_id !== filterEntityId) return false;
      if (filterBy === 'referrer' && order.referring_entity_id !== filterEntityId) return false;
    }
    
    if (filterStatus === 'pending' && order.balance <= 0.009) return false;
    if (filterStatus === 'paid' && order.balance > 0.009) return false;

    return true;
  });

  const totalPendingAmount = filteredOrders
    .filter(o => o.balance > 0.009)
    .reduce((sum, order) => sum + order.balance, 0);

  const totalPaidAmountInPeriod = filteredOrders
    .reduce((sum, order) => sum + order.paid_amount, 0);

  const entityOptions = filterBy === 'patient' ? patients : (filterBy === 'referrer' ? referrers : []);

  return {
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    currentPayment,
    setCurrentPayment,
    dateRange,
    setDateRange,
    filterBy,
    setFilterBy,
    filterEntityId,
    setFilterEntityId,
    filterStatus,
    setFilterStatus,
    getPatientName,
    getReferrerName,
    handleOpenPaymentModal,
    handlePaymentInputChange,
    handlePaymentDateChange,
    handleSubmitPayment,
    handleSendReminder,
    filteredOrders,
    isLoading,
    totalPendingAmount,
    totalPaidAmountInPeriod,
    entityOptions,
  };
};