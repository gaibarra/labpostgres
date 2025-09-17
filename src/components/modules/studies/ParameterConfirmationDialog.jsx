import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ParameterConfirmationDialog = ({ isOpen, onOpenChange, onConfirm, isSubmitting }) => {
  const handleConfirm = (e) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Cambios</AlertDialogTitle>
          <AlertDialogDescription>
            Estás a punto de guardar cambios en un parámetro. Estos cambios pueden afectar la forma en que se interpretan los resultados de los estudios. Por favor, revisa los cambios cuidadosamente antes de confirmar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Confirmando...' : 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ParameterConfirmationDialog;