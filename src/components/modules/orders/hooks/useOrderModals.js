import React, { useState, useMemo, useCallback } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
    import OrderForm from '@/components/modules/orders/OrderForm';
    import OrderPreviewModal from '@/components/modules/orders/OrderPreviewModal';
    import WorkSheetModal from '@/components/modules/orders/WorkSheetModal';
    import OrderResultsModal from '@/components/modules/orders/OrderResultsModal';
    import { useResultWorkflow } from '@/components/modules/orders/hooks/useResultWorkflow';
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
  // onFetchAIRecommendations,
  // currentOrder,
      setCurrentOrder,
      initialOrderForm
    }) => {
  const { toast } = useToast();
  const resultWorkflow = useResultWorkflow();
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
  const { patient } = getDetails(order);

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

      const handleFormSubmit = useCallback(async (orderData) => {
        setIsSubmitting(true);
        const savedOrder = await onSubmit(orderData, (newOrder) => {
          openModal('worksheet', newOrder);
        });
        setIsSubmitting(false);
        if (savedOrder) closeModal();
      }, [onSubmit, openModal, closeModal]);

      const handleValidateAndPreview = useCallback(async (orderId, results, status, notes) => {
        // Primera fase: persist draft with provided status (if user set Reportada we respect, else keep status)
        const desiredStatus = status === 'Reportada' ? 'Reportada' : status;
        await onSaveResults(orderId, results, desiredStatus, notes, async (saved) => {
          try {
            // Enforce validated stage if not already
            if (saved.status !== 'Reportada') {
              const locked = await resultWorkflow.validateAndLock(orderId);
              openModal('report', { ...saved, ...locked });
            } else {
              openModal('report', saved);
            }
          } catch (e) {
            toast({ title: 'Error validando', description: e.message, variant: 'destructive' });
          }
        });
      }, [onSaveResults, openModal, resultWorkflow, toast]);

  // openAIPreviewModal removed (unused)


      // Montaje permanente de todos los modales; sólo alternamos open
      const persistentModals = useMemo(() => {
        const { type, orderData, aiRecommendations } = modalState;
  const { patient, referrer } = getDetails(orderData);
        const isType = (t) => modalState.isOpen && type === t;

        return (
          <>
            <Dialog open={isType('form')} onOpenChange={closeModal} data-modal="order-form">
              {isType('form') && (
                <DialogContent className="sm:max-w-4xl bg-slate-50 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-sky-700 dark:text-sky-400">{(orderData?.id) ? 'Editar Orden' : 'Registrar Nueva Orden'}</DialogTitle>
                    <DialogDescription>Completa los detalles de la orden de trabajo.</DialogDescription>
                  </DialogHeader>
                  <OrderForm
                    initialOrderData={orderData}
                    onSubmit={handleFormSubmit}
                    patients={patients}
                    referrers={referrers}
                    studies={studiesDetails}
                    packages={packagesDetails}
                    onClose={closeModal}
                    isSubmitting={isSubmitting}
                  />
                </DialogContent>
              )}
            </Dialog>

            <OrderPreviewModal
              isOpen={isType('preview')}
              onOpenChange={closeModal}
              order={orderData}
              patient={patient}
              referrer={referrer}
              studiesDetails={studiesDetails}
              packagesData={packagesDetails}
            />

            <WorkSheetModal
              isOpen={isType('worksheet') && !!patient}
              onClose={closeModal}
              order={orderData}
              studiesDetails={studiesDetails}
              packagesDetails={packagesDetails}
              patientDetails={patient}
            />

            <OrderResultsModal
              isOpen={isType('results')}
              onOpenChange={closeModal}
              order={orderData}
              studiesDetails={studiesDetails}
              packagesData={packagesDetails}
              patient={patient}
              onSaveResults={onSaveResults}
              onValidateAndPreview={handleValidateAndPreview}
              workflowStage={resultWorkflow.stage}
            />

            <OrderQRLabelsModal
              isOpen={isType('labels')}
              onOpenChange={closeModal}
              order={orderData}
              patient={patient}
            />

            <FinalReportPreviewModal
              isOpen={isType('report')}
              onOpenChange={closeModal}
              order={orderData}
              patient={patient}
              referrer={referrer}
              studiesDetails={studiesDetails}
              packagesData={packagesDetails}
              onSend={() => {}}
            />

            <AIRecommendationsModal
              isOpen={isType('ai-recommendations')}
              onOpenChange={closeModal}
              order={orderData}
              patient={patient}
              studiesDetails={studiesDetails}
              packagesDetails={packagesDetails}
              onOpenPreview={(order, recommendations) => openModal('ai-preview', order, { recommendations })}
            />

            <AIRecommendationsPreviewModal
              isOpen={isType('ai-preview')}
              onOpenChange={closeModal}
              order={orderData}
              patient={patient}
              recommendations={aiRecommendations}
            />
          </>
        );
  }, [modalState, closeModal, getDetails, patients, referrers, studiesDetails, packagesDetails, onSaveResults, handleValidateAndPreview, handleFormSubmit, isSubmitting, openModal, resultWorkflow.stage]);

      return {
        openModal,
        closeModal,
        modalComponent: persistentModals,
      };
    };