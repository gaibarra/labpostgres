import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * Muestra un modal informando que la clave/código del estudio ya existe.
 * props:
 * - isOpen: bool
 * - onOpenChange: fn(bool)
 * - field: string | undefined (por defecto 'clave')
 * - value: string | undefined (valor duplicado)
 */
const DuplicateKeyDialog = ({ isOpen, onOpenChange, field = 'clave', value }) => {
  const fieldLabel = (field || '').toLowerCase() === 'name' ? 'nombre' : 'clave';
  const title = fieldLabel === 'clave' ? 'Clave ya existente' : 'Valor duplicado';
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-50 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription className="text-slate-700 dark:text-slate-300">
            {fieldLabel === 'clave'
              ? (
                <>
                  La clave ingresada ya está en uso{value ? <>: <span className="font-semibold text-slate-900 dark:text-slate-100">{String(value)}</span></> : ''}. 
                  Por favor ingresa una clave distinta para continuar.
                </>
              ) : (
                <>
                  El valor del campo <span className="font-semibold">{field}</span> ya está en uso{value ? <>: <span className="font-semibold text-slate-900 dark:text-slate-100">{String(value)}</span></> : ''}. 
                  Modifícalo para continuar.
                </>
              )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={()=> onOpenChange?.(false)} autoFocus>
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateKeyDialog;
