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

// Versión JSX alineada al patrón de MONTAJE PERSISTENTE.
// Mantiene la misma firma pública para no romper llamadas existentes, pero ahora
// todos los modales se montan una sola vez y sólo alternan su prop `isOpen`/`open`.
export const useOrderModals = ({ 
  studiesDetails,
  packagesDetails,
  patients,
  referrers,
  onSubmit,
  handleSaveResults,
  getStudiesAndParametersForOrder,
  loadData,
  referrerRef 
}) => {
  const { toast } = useToast();
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: null,
    order: null,
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
      order: order || { id: null, selected_items: [], status: 'Pendiente' },
      aiRecommendations: extraData.recommendations || null,
    });
  }, [getDetails, toast]);

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false, type: null }));
  }, []);

  // Foco diferido para el campo de referente sólo cuando el formulario está visible.
  useEffect(() => {
    if (modalState.isOpen && modalState.type === 'form' && modalState.order?.patient_id && !modalState.order.id) {
      const t = setTimeout(() => { referrerRef.current?.focus(); }, 100);
      return () => clearTimeout(t);
    }
  }, [modalState.isOpen, modalState.type, modalState.order, referrerRef]);

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

  // Helper para saber si el tipo activo coincide.
  const isType = useCallback((t) => modalState.isOpen && modalState.type === t, [modalState.isOpen, modalState.type]);

  // Montaje persistente: todos los modales conviven; sólo alternamos "open".
  const modalComponent = useMemo(() => {
    const { order, aiRecommendations } = modalState;
    const { patient, referrer } = getDetails(order);

    return (
      <>
        {/* Formulario de Orden */}
        <Dialog open={isType('form')} onOpenChange={closeModal} data-modal="order-form">
          {isType('form') && (
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
          )}
        </Dialog>

        {/* Vista previa */}
        <OrderPreviewModal
          isOpen={isType('preview')}
          onOpenChange={closeModal}
          order={order}
          patient={patient}
          referrer={referrer}
          studiesDetails={studiesDetails}
          packagesData={packagesDetails}
          onOpenLabelsPreview={() => openModal('labels-preview', order)}
        />

        {/* Hoja de trabajo */}
        <WorkSheetModal
          isOpen={isType('worksheet') && !!patient}
          onClose={closeModal}
          order={order}
          studiesDetails={studiesDetails}
          packagesDetails={packagesDetails}
          patientDetails={patient}
        />

        {/* Resultados */}
        <OrderResultsModal
          isOpen={isType('results')}
          onOpenChange={closeModal}
          order={order}
          studiesDetails={studiesDetails}
          packagesData={packagesDetails}
          patient={patient}
          onSaveResults={handleSaveResults}
          onValidateAndPreview={handleValidateAndPreview}
        />

        {/* Etiquetas (labels-preview) */}
        <OrderLabelsPreviewModal
          isOpen={isType('labels-preview')}
          onOpenChange={closeModal}
          order={order}
        />

        {/* Reporte final */}
        <FinalReportPreviewModal
          isOpen={isType('report')}
          onOpenChange={closeModal}
          order={order}
          patient={patient}
          referrer={referrer}
          studiesDetails={studiesDetails}
          packagesData={packagesDetails}
          onSend={() => {}}
        />

        {/* Recomendaciones AI */}
        <AIRecommendationsModal
          isOpen={isType('ai-recommendations')}
          onOpenChange={closeModal}
          order={order}
          patient={patient}
          studiesToDisplay={order ? getStudiesAndParametersForOrder(order.selected_items || [], studiesDetails, packagesDetails) : []}
          onOpenPreview={openAIPreviewModal}
        />

        {/* Preview AI */}
        <AIRecommendationsPreviewModal
          isOpen={isType('ai-preview')}
          onOpenChange={closeModal}
          order={order}
          patient={patient}
          recommendations={aiRecommendations}
        />
      </>
    );
  }, [modalState, getDetails, isType, closeModal, handleFormSubmit, patients, referrers, studiesDetails, packagesDetails, isSubmitting, openModal, handleSaveResults, handleValidateAndPreview, getStudiesAndParametersForOrder, openAIPreviewModal]);

  return {
    modalState,
    openModal,
    closeModal,
    modalComponent,
  };
};