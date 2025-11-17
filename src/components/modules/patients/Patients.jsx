import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { useAppData } from '@/contexts/AppDataContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { apiClient } from '@/lib/apiClient';

import PatientsHeader from './PatientsHeader';
import PatientsTable from './PatientsTable';
import PatientsCardView from './PatientsCardView';
import PatientForm from './PatientForm';
import DeletePatientDialog from './DeletePatientDialog';
import SuccessPatientDialog from './SuccessPatientDialog';
import PatientHelpDialog from './PatientHelpDialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const Patients = () => {
  const {
    patients,
    patientsPage,
    patientsCount,
    PAGE_SIZE,
    loadingPatients,
    loadPatients,
    refreshData
  } = useAppData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', description: '' });

  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const searchAppliedRef = useRef(false);
  useEffect(() => {
    if (!searchAppliedRef.current) {
      searchAppliedRef.current = true;
      return;
    }
    loadPatients(0, debouncedSearchTerm);
  }, [debouncedSearchTerm, loadPatients]);

  const renderedPatients = patients || [];

  const openForm = useCallback((patient = null) => {
    setCurrentPatient(patient);
    setIsFormOpen(true);
  }, []);

  const handleViewHistory = useCallback((patientId) => {
    navigate(`/patients/${patientId}/history`);
  }, [navigate]);

  const handleSave = async (patientData, andNewOrder = false) => {
    setIsSaving(true);
    let patientResult;
    const { id, ...dataToUpsert } = patientData;
    try {
      if (id) {
        patientResult = await apiClient.put(`/patients/${id}`, dataToUpsert);
      } else {
        patientResult = await apiClient.post('/patients', dataToUpsert);
      }
      await refreshData('patients');
      setIsFormOpen(false);
      setCurrentPatient(null);
      if (andNewOrder) {
        toast({ title: `Paciente ${id ? 'Actualizado' : 'Registrado'}`, description: 'Redirigiendo para crear nueva orden...' });
        navigate('/orders', { state: { newPatientId: patientResult.id } });
      } else {
        setSuccessMessage({ title: `Paciente ${id ? 'Actualizado' : 'Registrado'}`, description: `El paciente ${patientResult.full_name} ha sido guardado exitosamente.` });
        setIsSuccessModalOpen(true);
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };
  
  const openDeleteDialog = useCallback((patient) => {
    setPatientToDelete(patient);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = async () => {
    if (!patientToDelete) return;
    try { await apiClient.delete(`/patients/${patientToDelete.id}`); toast({ title: 'Paciente Eliminado', variant: 'destructive' }); await refreshData('patients'); }
    catch (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    setIsDeleteDialogOpen(false);
    setPatientToDelete(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <PatientHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      
      <Card className="shadow-lg glass-card flex flex-col h-[calc(100vh-100px)]">
        <PatientsHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onNewPatientClick={() => openForm()}
          onHelpClick={() => setIsHelpDialogOpen(true)}
          currentPage={patientsPage}
          totalCount={patientsCount}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => loadPatients(page, debouncedSearchTerm)}
        />
        <CardContent className="flex-grow p-2 md:p-6 pt-0">
          {loadingPatients ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-250px)]">
              {isMobile ? (
                <PatientsCardView
                  patients={renderedPatients}
                  onEdit={openForm}
                  onDelete={openDeleteDialog}
                  onViewHistory={handleViewHistory}
                />
              ) : (
                <div className="overflow-x-auto">
                  <PatientsTable
                    patients={renderedPatients}
                    onEdit={openForm}
                    onDelete={openDeleteDialog}
                    onViewHistory={handleViewHistory}
                  />
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-3xl" aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle>{currentPatient?.id ? 'Editar Paciente' : 'Nuevo Paciente'}</DialogTitle>
            <DialogDescription id="dialog-description">
              {currentPatient?.id ? 'Modifica los datos del paciente.' : 'Completa los datos para registrar un nuevo paciente.'}
            </DialogDescription>
          </DialogHeader>
          <PatientForm
            patient={currentPatient}
            onSave={handleSave}
            onCancel={() => { setIsFormOpen(false); setCurrentPatient(null); }}
            isLoading={isSaving}
          />
        </DialogContent>
      </Dialog>

      <DeletePatientDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        patientToDelete={patientToDelete}
        onConfirmDelete={confirmDelete}
      />
      
      <SuccessPatientDialog
        isOpen={isSuccessModalOpen}
        onOpenChange={setIsSuccessModalOpen}
        title={successMessage.title}
        description={successMessage.description}
      />
    </motion.div>
  );
};

export default Patients;