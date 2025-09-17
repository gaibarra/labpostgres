import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, UserPlus, Edit, Trash2, Search, DollarSign, FileText } from 'lucide-react';

const ReferrerHelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-sky-600" />
            Ayuda de Gestión de Referentes
          </DialogTitle>
          <DialogDescription>
            Guía para administrar médicos, instituciones y otros referentes que envían pacientes.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <UserPlus className="mr-2 h-5 w-5 text-blue-500" />
                  Añadir y Editar Referentes
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Utiliza el botón <strong>"Nuevo Referente"</strong> para registrar médicos, instituciones, empresas, etc. En el formulario, puedes especificar el tipo de referente, su especialidad (si aplica) y sus datos de contacto.
                </p>
                <p className="mb-2 font-semibold">
                  Referente 'Particular':
                </p>
                <p className="text-sm">
                  Este es un referente especial del sistema que no puede ser editado ni eliminado. Su propósito es establecer la <strong>lista de precios base</strong>. Cualquier precio que no se defina específicamente para otro referente, tomará el valor de la lista de 'Particular'.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Search className="mr-2 h-5 w-5 text-green-500" />
                  Búsqueda y Filtros
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Usa la barra de búsqueda para encontrar referentes por <strong>nombre, tipo, especialidad o email</strong>. La tabla se filtrará automáticamente a medida que escribes.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Edit className="mr-2 h-5 w-5 text-purple-500" />
                  Acciones en la Tabla
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                 <p className="mb-2">
                  Cada referente en la tabla tiene un menú de acciones (botón de tres puntos) con las siguientes opciones:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong className="flex items-center gap-1"><Edit className="h-4 w-4"/>Editar Datos:</strong> Permite modificar la información del referente (no disponible para 'Particular').</li>
                  <li><strong className="flex items-center gap-1"><DollarSign className="h-4 w-4 text-green-500"/>Gestionar Precios:</strong> Abre una ventana para asignar precios específicos a estudios y paquetes para ese referente. Esta es la función principal para crear listas de precios personalizadas.</li>
                  <li><strong className="flex items-center gap-1"><FileText className="h-4 w-4"/>Ver Lista (PDF):</strong> Genera y muestra un documento PDF con la lista de precios actual del referente, listo para imprimir o descargar.</li>
                  <li><strong className="flex items-center gap-1"><Trash2 className="h-4 w-4"/>Eliminar Referente:</strong> Borra permanentemente al referente del sistema (no disponible para 'Particular').</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferrerHelpDialog;