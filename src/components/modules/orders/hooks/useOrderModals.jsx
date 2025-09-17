import React, { useState, useMemo, useCallback, useEffect } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
    import OrderForm from '@/components/modules/orders/OrderForm';
    import OrderPreviewModal from '@/components/modules/orders/OrderPreviewModal';
    import WorkSheetModal from '@/components/modules/orders/WorkSheetModal';
    import OrderResultsModal from '@/components/modules/orders/OrderResultsModal';
    import OrderLabelsPreviewModal from '@/components/modules/orders/OrderLabelsPreviewModal';
    import FinalReportPreviewModal from '@/components/modules/orders/FinalReportPreviewModal';
    import AIRecommendationsModal from '@/components/modules/orders/AIRecommendationsModal';
    import AIRecommendationsPreviewModal from '@/components/modules/orders/AIRecommendationsPreviewModal';
    import { useToast } from "@/components/ui/use-toast";
    import { useOrderManagement } from './useOrderManagement';

    export const useOrderModals = ({ studiesDetails, packagesDetails, patients, referrers, onSubmit, referrerRef }) => {
      const { toast } = useToast();
      const [modalState, setModalState] = useState({
        isOpen: false,
        type: null,
        order: null,
        patientDetails: null,
        referrerDetails: null,
        aiRecommendations: null,
      });
      const [isSubmitting, setIsSubmitting] = useState(false);

      const { handleSaveResults, loadData, getStudiesAndParametersForOrder } = useOrderManagement();

      const getDetails = useCallback((order) => {
        if (!order || !order.patient_id) return { patient: null, referrer: null };
        
        const patient = patients.find(p => p.id === order.patient_id);
        const referrer = referrers.find(r => r.id === order.referring_entity_id);

        return { patient, referrer };
      }, [patients, referrers]);

      const openModal = useCallback((type, order, extraData = {}) => {
        const { patient, referrer } = getDetails(order);

        if (!patient && ['preview', 'worksheet', 'results', 'report', 'labels-preview', 'form', 'ai-recommendations', 'ai-preview'].includes(type) && order?.id) {
           toast({
            title: "Error de datos",
            description: "No se pudieron encontrar los detalles del paciente para esta orden. Intente recargar la página.",
            variant: "destructive",
          });
          return;
        }
        setModalState({ 
          isOpen: true, 
          type, 
          order, 
          patientDetails: patient, 
          referrerDetails: referrer,
          aiRecommendations: extraData.recommendations || null,
        });
      }, [getDetails, toast]);

      useEffect(() => {
        if (modalState.isOpen && modalState.type === 'form' && modalState.order?.patient_id && !modalState.order.id) {
          setTimeout(() => {
            referrerRef.current?.focus();
          }, 100);
        }
      }, [modalState.isOpen, modalState.type, modalState.order, referrerRef]);

      const closeModal = useCallback(() => {
        setModalState(prev => ({ ...prev, isOpen: false, order: null, patientDetails: null, referrerDetails: null, aiRecommendations: null }));
      }, []);

      const handleFormSubmit = async (orderData) => {
        setIsSubmitting(true);
        const savedOrder = await onSubmit(orderData);
        setIsSubmitting(false);
        if (savedOrder) {
          closeModal();
          await loadData();
        }
      };

      const handleValidateAndPreview = useCallback(async (orderId, results, status, notes) => {
        await handleSaveResults(orderId, results, status, notes, (updatedOrder) => {
          openModal('report', updatedOrder);
        });
      }, [handleSaveResults, openModal]);

      const openAIPreviewModal = useCallback((order, recommendations) => {
        openModal('ai-preview', order, { recommendations });
      }, [openModal]);


      const modalComponent = useMemo(() => {
        if (!modalState.isOpen || !modalState.order) return null;

        const { type, order, patientDetails, referrerDetails, aiRecommendations } = modalState;

        switch (type) {
          case 'form':
            return (
              <Dialog open={true} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-4xl bg-slate-50 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-sky-700 dark:text-sky-400">{order?.id ? 'Editar Orden' : 'Registrar Nueva Orden'}</DialogTitle>
                    <DialogDescription>Completa los detalles de la orden de trabajo.</DialogDescription>
                  </DialogHeader>
                  <OrderForm
                    initialOrderData={order}
                    onSubmit={handleFormSubmit}
                    patients={patients}
                    referrers={referrers}
                    studies={studiesDetails}
                    packages={packagesDetails}
                    onClose={closeModal}
                    isSubmitting={isSubmitting}
                    referrerRef={referrerRef}
                  />
                </DialogContent>
              </Dialog>
            );
          case 'preview':
            return (
              <OrderPreviewModal
                isOpen={true}
                onOpenChange={closeModal}
                order={order}
                patient={patientDetails}
                referrer={referrerDetails}
                studiesDetails={studiesDetails}
                packagesData={packagesDetails}
                onOpenLabelsPreview={() => openModal('labels-preview', order)}
              />
            );
          case 'worksheet':
             if (!patientDetails) return null;
            return (
              <WorkSheetModal
                isOpen={true}
                onClose={closeModal}
                order={order}
                studiesDetails={studiesDetails}
                packagesDetails={packagesDetails}
                patientDetails={patientDetails}
              />
            );
          case 'results':
            return (
              <OrderResultsModal
                isOpen={true}
                onOpenChange={closeModal}
                order={order}
                studiesDetails={studiesDetails}
                packagesData={packagesDetails}
                patient={patientDetails}
                onSaveResults={handleSaveResults}
                onValidateAndPreview={handleValidateAndPreview}
              />
            );
          case 'labels-preview':
            return (
              <OrderLabelsPreviewModal
                isOpen={true}
                onOpenChange={closeModal}
                order={order}
              />
            );
          case 'report':
            return (
              <FinalReportPreviewModal
                isOpen={true}
                onOpenChange={closeModal}
                order={order}
                patient={patientDetails}
                referrer={referrerDetails}
                studiesDetails={studiesDetails}
                packagesData={packagesDetails}
                onSend={() => {}}
              />
            );
          case 'ai-recommendations':
            const studiesToDisplay = getStudiesAndParametersForOrder(order.selected_items, studiesDetails, packagesDetails);
            return (
              <AIRecommendationsModal
                isOpen={true}
                onOpenChange={closeModal}
                order={order}
                patient={patientDetails}
                studiesToDisplay={studiesToDisplay}
                onOpenPreview={openAIPreviewModal}
              />
            );
           case 'ai-preview':
            return (
                <AIRecommendationsPreviewModal
                    isOpen={true}
                    onOpenChange={closeModal}
                    order={order}
                    patient={patientDetails}
                    recommendations={aiRecommendations}
                />
            );
          default:
            return null;
        }
      }, [modalState, closeModal, openModal, studiesDetails, packagesDetails, patients, referrers, handleSaveResults, handleValidateAndPreview, handleFormSubmit, isSubmitting, getStudiesAndParametersForOrder, openAIPreviewModal, referrerRef]);

      return {
        modalState,
        openModal,
        closeModal,
        modalComponent,
      };
    };