import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useStudies, initialStudyFormState } from './studies/hooks/useStudies';
import StudiesHeader from './studies/StudiesHeader';
import StudiesTable from './studies/StudiesTable';
import StudyForm from './studies/StudyForm';
import DeleteStudyDialog from './studies/DeleteStudyDialog';
import AIAssistDialog from './studies/AIAssistDialog';
import AIAssistPreviewModal from './studies/AIAssistPreviewModal';
import StudyPriceAssignmentModal from './studies/StudyPriceAssignmentModal';
import StudyHelpDialog from './studies/StudyHelpDialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import StudiesCardView from './studies/StudiesCardView';
import { useAppData } from '@/contexts/AppDataContext';

const Studies = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState(''); // Move this declaration up

  const {
    studies,
    studiesCount,
    loadingStudies,
    isSubmitting,
    getParticularPrice,
    handleSubmit,
    handleImmediateParameterSave,
  handleDeleteStudy,
  handleImmediateParameterDelete,
  persistParameterOrder,
    updateStudyPrices,
    studiesPage,
    setStudiesPage,
    PAGE_SIZE,
    totalStudiesPages,
  } = useStudies(searchTerm);
  const { referrers } = useAppData();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentStudy, setCurrentStudy] = useState(initialStudyFormState);
  const [studyToDelete, setStudyToDelete] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isAIAssistOpen, setIsAIAssistOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [studyForPricing, setStudyForPricing] = useState(null);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [aiGeneratedData, setAiGeneratedData] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // SWR handles loading, so this useEffect is no longer needed.
  // useEffect(() => {
  //     if(user) {
  //         loadStudies(studiesPage, searchTerm);
  //     }
  // }, [user, loadStudies, studiesPage, searchTerm]);

  const handleNewStudyClick = () => {
    setCurrentStudy({ ...initialStudyFormState, parameters: [] });
    setIsFormOpen(true);
  };

  const handleEdit = useCallback((study) => {
    const priceForParticular = getParticularPrice(study.id);
    setCurrentStudy(prevStudy => ({
      ...prevStudy,
      ...study,
      particularPrice: priceForParticular === '0.00' ? '' : priceForParticular,
    }));
    setIsFormOpen(true);
  }, [getParticularPrice]);

  const openDeleteConfirmDialog = useCallback((study) => {
    setStudyToDelete(study);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleAssignPrices = useCallback((study) => {
    setStudyForPricing(study);
    setIsPriceModalOpen(true);
  }, []);

  const handleFormSubmit = async (studyData) => {
    const success = await handleSubmit(studyData);
    if (success) {
      setIsFormOpen(false);
      // Solo reiniciar currentStudy si se está creando un nuevo estudio
      if (!studyData.id) setCurrentStudy(initialStudyFormState);
    }
  };

  const handleConfirmDelete = async () => {
    if (!studyToDelete) return;
    const success = await handleDeleteStudy(studyToDelete);
    if (success) {
      setStudyToDelete(null);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleAIGenerationSuccess = (data) => {
    setAiGeneratedData(data);
    setIsAIAssistOpen(false);
    setIsPreviewModalOpen(true);
  };

  const handleAcceptAIPreview = () => {
    setCurrentStudy(aiGeneratedData);
    setIsPreviewModalOpen(false);
    setIsFormOpen(true);
    setAiGeneratedData(null);
  };

  const handleCancelAIPreview = () => {
    setIsPreviewModalOpen(false);
    setAiGeneratedData(null);
  };

  // TODO: Implement a proper way to handle reference value editing and deletion.
  // The current implementation is not ideal and has been removed.
  // A possible solution is to handle this logic inside the StudyForm component
  // or a dedicated context/hook for managing study data.

  // The filtering is now done server-side in useStudies hook
  const displayedStudies = studies;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col h-full"
    >
      <StudyHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
  setIsFormOpen(isOpen);
  // No reiniciar currentStudy al cerrar el formulario, solo cerrar el diálogo
      }}>
        <Card className="shadow-xl glass-card flex flex-col flex-grow">
          <StudiesHeader
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onNewStudyClick={handleNewStudyClick}
            onAIAssist={() => setIsAIAssistOpen(true)}
            onHelpClick={() => setIsHelpDialogOpen(true)}
            currentPage={studiesPage}
            totalCount={studiesCount}
            pageSize={PAGE_SIZE}
            onPageChange={setStudiesPage}
            onSearch={(term) => loadStudies(0, term)} // Always go to first page on new search
            totalStudiesPages={totalStudiesPages} // Pass the new prop
          />
          <CardContent className="flex-grow p-2 md:p-6 pt-0">
            {loadingStudies ? (
              <div className="flex justify-center items-center h-full flex-grow">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-220px)]">
                {isMobile ? (
                  <StudiesCardView
                    studies={displayedStudies}
                    onEdit={handleEdit}
                    onDeleteConfirm={openDeleteConfirmDialog}
                    onAssignPrices={handleAssignPrices}
                    getParticularPrice={getParticularPrice}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <StudiesTable
                      studies={displayedStudies}
                      onEdit={handleEdit}
                      onDeleteConfirm={openDeleteConfirmDialog}
                      onAssignPrices={handleAssignPrices}
                      getParticularPrice={getParticularPrice}
                    />
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
          {!loadingStudies && studiesCount > 0 && (
            <CardFooter className="text-sm text-muted-foreground p-6 pt-0">
              Mostrando {studies.length} de {studiesCount} estudios.
            </CardFooter>
          )}
        </Card>

        <DialogContent className="sm:max-w-3xl bg-slate-50 dark:bg-slate-900 max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-sky-700 dark:text-sky-400">
              {currentStudy.id ? 'Editar Estudio' : 'Registrar Nuevo Estudio'}
            </DialogTitle>
            <DialogDescription>
              Completa los detalles del estudio a continuación.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[75vh] p-4">
            <StudyForm
              initialStudy={currentStudy}
              onSubmit={handleFormSubmit}
              onAIAssist={() => {
                setIsFormOpen(false);
                setIsAIAssistOpen(true);
              }}
              onCancel={() => {
                setIsFormOpen(false);
                // No reiniciar currentStudy al cancelar edición, solo cerrar el formulario
              }}
              getParticularPriceForStudy={getParticularPrice}
              isSubmitting={isSubmitting}
              onImmediateParameterSave={handleImmediateParameterSave}
              onImmediateParameterDelete={handleImmediateParameterDelete}
              onPersistParameterOrder={persistParameterOrder}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <DeleteStudyDialog
        isOpen={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        studyToDelete={studyToDelete}
        onConfirmDelete={handleConfirmDelete}
        isSubmitting={isSubmitting}
      />

      <AIAssistDialog
        isOpen={isAIAssistOpen}
        onOpenChange={setIsAIAssistOpen}
        onGenerationSuccess={handleAIGenerationSuccess}
      />

      <AIAssistPreviewModal
        isOpen={isPreviewModalOpen}
        onOpenChange={setIsPreviewModalOpen}
        studyData={aiGeneratedData}
        onAccept={handleAcceptAIPreview}
        onCancel={handleCancelAIPreview}
      />

      {studyForPricing && (
        <StudyPriceAssignmentModal
          isOpen={isPriceModalOpen}
          onOpenChange={(isOpen) => {
            setIsPriceModalOpen(isOpen);
            if (!isOpen) setStudyForPricing(null);
          }}
          study={studyForPricing}
          referrers={referrers}
          onUpdatePrices={updateStudyPrices}
          isSubmitting={isSubmitting}
        />
      )}
    </motion.div>
  );
};

export default Studies;