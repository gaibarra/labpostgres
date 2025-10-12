import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { CreditCard } from 'lucide-react';
import { useAccountsReceivable } from '@/components/modules/finance/hooks/useAccountsReceivable';
import ARHeader from '@/components/modules/finance/accounts_receivable/ARHeader';
import ARTable from '@/components/modules/finance/accounts_receivable/ARTable';
import PaymentModal from '@/components/modules/finance/accounts_receivable/PaymentModal';

const AccountsReceivable = () => {
  const {
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
  getPatientPhone,
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
  } = useAccountsReceivable();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/70 dark:via-indigo-900/70 dark:to-purple-900/70 p-6">
          <div className="flex items-center">
            <CreditCard className="h-10 w-10 mr-4 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                Cuentas por Cobrar
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Gestiona y da seguimiento a los saldos pendientes de tus órdenes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <ARHeader
            dateRange={dateRange}
            onDateChange={setDateRange}
            filterBy={filterBy}
            onFilterByChange={setFilterBy}
            filterEntityId={filterEntityId}
            onFilterEntityIdChange={setFilterEntityId}
            entityOptions={entityOptions}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            isLoading={isLoading}
          />
          <ARTable
            orders={filteredOrders}
            getPatientName={getPatientName}
            getReferrerName={getReferrerName}
            getPatientPhone={getPatientPhone}
            onOpenPaymentModal={handleOpenPaymentModal}
            onSendReminder={handleSendReminder}
            totalPendingAmount={totalPendingAmount}
            totalPaidAmountInPeriod={totalPaidAmountInPeriod}
            filterStatus={filterStatus}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onOpenChange={(isOpen) => {
          setIsPaymentModalOpen(isOpen);
          if (!isOpen) setCurrentPayment({ orderId: null, orderFolio: '', paymentAmount: '', paymentDate: new Date(), paymentNotes: '' });
        }}
        currentPayment={currentPayment}
        onPaymentInputChange={handlePaymentInputChange}
        onPaymentDateChange={handlePaymentDateChange}
        onSubmitPayment={handleSubmitPayment}
        isLoading={isLoading}
      />
    </motion.div>
  );
};

export default AccountsReceivable;