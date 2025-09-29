import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PackageForm from './PackageForm';

const PackageFormDialog = ({ isOpen, onOpenChange, currentPackage, onSubmit, availableStudies, availablePackagesForSelection, initialPackageForm, isSubmitting }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl bg-slate-50 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-sky-700 dark:text-sky-400">{currentPackage.id ? 'Editar Paquete' : 'Crear Nuevo Paquete'}</DialogTitle>
          <DialogDescription>
            Define un nuevo paquete de estudios o modifica uno existente.
          </DialogDescription>
        </DialogHeader>
        <PackageForm
          currentPackage={currentPackage}
          onSubmit={onSubmit}
          availableStudies={availableStudies}
          availablePackagesForSelection={availablePackagesForSelection}
          initialPackageForm={initialPackageForm}
          closeForm={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          // embedded mode expects closeForm prop
        />
      </DialogContent>
    </Dialog>
  );
};

export default PackageFormDialog;