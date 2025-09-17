import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';

const DeletePackageDialog = ({ isOpen, onOpenChange, packageToDelete, onConfirmDelete, isSubmitting }) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-50 dark:bg-slate-900">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600 dark:text-red-400">¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
            Esta acción eliminará permanentemente el paquete <span className="font-semibold">{packageToDelete?.name}</span>.
            Se eliminará de todas las listas de precios. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmDelete} className="bg-red-500 hover:bg-red-600 text-white" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeletePackageDialog;