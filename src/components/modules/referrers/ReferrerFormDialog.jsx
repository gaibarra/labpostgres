import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ReferrerForm from './ReferrerForm';
import { useToast } from "@/components/ui/use-toast";

const ReferrerFormDialog = ({ isOpen, onOpenChange, referrer, onSave, isSubmitting }) => {
  const { toast } = useToast();
  const getInitialState = () => ({
    id: null,
    name: '',
    entity_type: 'Médico',
    specialty: '',
    phone_number: '',
    email: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    social_media: { facebook: '', instagram: '', whatsapp: '' },
    listaprecios: { studies: [], packages: [] },
  });

  const [currentReferrer, setCurrentReferrer] = useState(getInitialState());

  useEffect(() => {
    if (isOpen) {
      setCurrentReferrer(referrer || getInitialState());
    } else {
      setCurrentReferrer(getInitialState());
    }
  }, [referrer, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('social_media.')) {
      const key = name.split('social_media.')[1];
      setCurrentReferrer(prev => ({
        ...prev,
        social_media: {
          ...(prev.social_media && typeof prev.social_media === 'object' ? prev.social_media : {}),
          [key]: value
        }
      }));
      return;
    }
    setCurrentReferrer(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setCurrentReferrer(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    // Email ya no es obligatorio. Solo validamos formato si viene NO vacío.
    if (!currentReferrer.name || !currentReferrer.entity_type) {
      toast({
        title: "Campos obligatorios",
        description: "Por favor, complete Nombre y Tipo.",
        variant: "destructive",
      });
      return false;
    }
    const rawEmail = (currentReferrer.email || '').trim();
    if (rawEmail.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawEmail)) {
        toast({
          title: "Email inválido",
          description: "Formato de correo no válido.",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(currentReferrer);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-slate-50 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-sky-700 dark:text-sky-400">{currentReferrer.id ? 'Editar Referente' : 'Registrar Nuevo Referente'}</DialogTitle>
          <DialogDescription>
            {currentReferrer.name === 'Particular' ? "Los datos básicos de 'Particular' no son editables. Gestiona sus precios desde el botón 'Precios' en la tabla." : "Completa los datos del referente."}
          </DialogDescription>
        </DialogHeader>
        <ReferrerForm 
          currentReferrer={currentReferrer}
          handleInputChange={handleInputChange}
          handleSelectChange={handleSelectChange}
          handleSubmit={handleSubmit}
          closeForm={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ReferrerFormDialog;