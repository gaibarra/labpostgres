import React, { useState, useMemo, useCallback } from 'react';
    import { AnimatePresence } from 'framer-motion';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
    import OrderForm from '@/components/modules/orders/OrderForm';
    import OrderPreviewModal from '@/components/modules/orders/OrderPreviewModal';
    import WorkSheetModal from '@/components/modules/orders/WorkSheetModal';
    import OrderResultsModal from '@/components/modules/orders/OrderResultsModal';
    import OrderQRLabelsModal from '@/components/modules/orders/OrderQRLabelsModal';
    import FinalReportPreviewModal from '@/components/modules/orders/FinalReportPreviewModal';
    import AIRecommendationsModal from '@/components/modules/orders/AIRecommendationsModal';
    import AIRecommendationsPreviewModal from '@/components/modules/orders/AIRecommendationsPreviewModal';
    import { useToast } from "@/components/ui/use-toast";

    export const useOrderModals = ({ 
      studiesDetails, 
      packagesDetails, 
      patients, 
      referrers, 
      onSubmit,
      onSaveResults,
      onFetchAIRecommendations,
      currentOrder,
      setCurrentOrder,
      initialOrderForm
    }) => {
      const { toast } = useToast();
      const [modalState, setModalState] = useState({
        isOpen: false,
        type: null,
        orderData: null,
        aiRecommendations: null,
      });
      const [isSubmitting, setIsSubmitting] = useState(false);
      
      const getDetails = useCallback((order) => {
        if (!order || !order.patient_id) return { patient: null, referrer: null };
        const patient = patients.find(p => p.id === order.patient_id);
        const referrer = referrers.find(r => r.id === order.referring_entity_id);
        return { patient, referrer };
      }, [patients, referrers]);

      const openModal = useCallback((type, order, extraData = {}) => {
        const { patient, referrer } = getDetails(order);

        if (!patient && ['preview', 'worksheet', 'results', 'report', 'labels', 'form', 'ai-recommendations', 'ai-preview'].includes(type) && order?.id) {
           toast({
            title: "Error de datos",
            description: "No se pudieron encontrar los detalles del paciente para esta orden. Intente recargar la página.",
            variant: "destructive",
          });
          return;
        }

        if (type === 'form') {
           setCurrentOrder(order || initialOrderForm);
        }

        setModalState({ 
          isOpen: true, 
          type, 
          orderData: order, 
          aiRecommendations: extraData.recommendations || null,
        });
      }, [getDetails, toast, setCurrentOrder, initialOrderForm]);

      const closeModal = useCallback(() => {
        setModalState(prev => ({ ...prev, isOpen: false, orderData: null, aiRecommendations: null }));
        if (modalState.type === 'form') {
            setCurrentOrder(initialOrderForm);
        }
      }, [modalState.type, setCurrentOrder, initialOrderForm]);

      const handleFormSubmit = async (orderData) => {
        setIsSubmitting(true);
        const savedOrder = await onSubmit(orderData, (newOrder) => {
            openModal('worksheet', newOrder);
        });
        setIsSubmitting(false);
        if (savedOrder) {
          closeModal();
        }
      };

      const handleValidateAndPreview = useCallback(async (orderId, results, status, notes) => {
        await onSaveResults(orderId, results, status, notes, (updatedOrder) => {
          openModal('report', updatedOrder);
        });
      }, [onSaveResults, openModal]);

      const openAIPreviewModal = useCallback((order, recommendations) => {
        openModal('ai-preview', order, { recommendations });
      }, [openModal]);


      const modalComponent = useMemo(() => {
        if (!modalState.isOpen || (!modalState.orderData && modalState.type !== 'form')) return null;

        const { type, orderData, aiRecommendations } = modalState;
        const { patient, referrer } = getDetails(orderData);

        const orderToUse = type === 'form' ? currentOrder : orderData;

        switch (type) {
          case 'form':
            return (
              <Dialog open={true} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-4xl bg-slate-50 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-sky-700 dark:text-sky-400">{orderToUse?.id ? 'Editar Orden' : 'Registrar Nueva Orden'}</DialogTitle>
                    <DialogDescription>Completa los detalles de la orden de trabajo.</DialogDescription>
                  </DialogHeader>
                  <OrderForm
                    initialOrderData={orderToUse}
                    onSubmit={handleFormSubmit}
                    patients={patients}
                    referrers={referrers}
                    studies={studiesDetails}
                    packages={packagesDetails}
                    onClose={closeModal}
                    isSubmitting={isSubmitting}
                  />
                </DialogContent>
              </Dialog>
            );
          case 'preview':
            return (
              <OrderPreviewModal
                isOpen={true}
                onOpenChange={closeModal}
                order={orderData}
                patient={patient}
                referrer={referrer}
                studiesDetails={studiesDetails}
                packagesData={packagesDetails}
              />
            );
          case 'worksheet':
             if (!patient) return null;
            return (
              <WorkSheetModal
                isOpen={true}
                onClose={closeModal}
                order={orderData}
                studiesDetails={studiesDetails}
                packagesDetails={packagesDetails}
                patientDetails={patient}
              />
            );
          case 'results':
            return (
              <OrderResultsModal
                isOpen={true}
                onOpenChange={closeModal}
                order={orderData}
                studiesDetails={studiesDetails}
                packagesData={packagesDetails}
                patient={patient}
                onSaveResults={onSaveResults}
                onValidateAndPreview={handleValidateAndPreview}
              />
            );
          case 'labels':
            return (
              <OrderQRLabelsModal
                isOpen={true}
                onOpenChange={closeModal}
                order={orderData}
                patient={patient}
              />
            );
          case 'report':
            return (
              <FinalReportPreviewModal
                isOpen={true}
                onOpenChange={closeModal}
                order={orderData}
                patient={patient}
                referrer={referrer}
                studiesDetails={studiesDetails}
                packagesData={packagesDetails}
                onSend={() => {}}
              />
            );
          case 'ai-recommendations':
            return (
              <AIRecommendationsModal
                isOpen={true}
                onOpenChange={closeModal}
                order={orderData}
                patient={patient}
                studiesDetails={studiesDetails}
                packagesDetails={packagesDetails}
                onOpenPreview={openAIPreviewModal}
              />
            );
           case 'ai-preview':
            return (
                <AIRecommendationsPreviewModal
                    isOpen={true}
                    onOpenChange={closeModal}
                    order={orderData}
                    patient={patient}
                    recommendations={aiRecommendations}
                />
            );
          default:
            return null;
        }
      }, [modalState, closeModal, studiesDetails, packagesDetails, patients, referrers, onSaveResults, handleValidateAndPreview, handleFormSubmit, isSubmitting, openAIPreviewModal, currentOrder]);

      return {
        openModal,
        closeModal,
        modalComponent: <AnimatePresence>{modalComponent}</AnimatePresence>,
      };
    };