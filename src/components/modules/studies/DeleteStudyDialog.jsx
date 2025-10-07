import React from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';

const DeleteStudyDialog = ({ isOpen, onOpenChange, studyToDelete, onConfirmDelete, isSubmitting }) => {
  if (!isOpen || !studyToDelete) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-50 dark:bg-slate-900">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600 dark:text-red-400">¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
            Esta acción no se puede deshacer. Esto eliminará permanentemente el estudio <span className="font-semibold">{studyToDelete.name}</span> y todos sus parámetros asociados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            type="button"
            data-testid="delete-study-cancel"
            tabIndex={0}
            onClick={(e)=>{ e.stopPropagation(); try { onOpenChange(false); } catch(err){ /* noop */ } console.debug('[DeleteStudyDialog] cancel click'); }}
          >Cancelar</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            data-testid="delete-study-confirm"
            tabIndex={0}
            onClick={async (e)=>{ e.stopPropagation(); if (isSubmitting) { console.debug('[DeleteStudyDialog] blocked isSubmitting'); return; } console.debug('[DeleteStudyDialog] delete click', { id: studyToDelete?.id }); try { await onConfirmDelete?.(); } catch(err){ console.error('[DeleteStudyDialog] onConfirmDelete error', err); } }}
            disabled={isSubmitting}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteStudyDialog;