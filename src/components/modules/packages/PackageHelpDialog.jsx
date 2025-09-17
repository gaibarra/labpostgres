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
import { HelpCircle, PackagePlus, DollarSign, Edit, Trash2 } from 'lucide-react';

const PackageHelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-sky-600" />
            Ayuda de Gestión de Paquetes
          </DialogTitle>
          <DialogDescription>
            Guía para crear y administrar paquetes de estudios y perfiles de laboratorio.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <PackagePlus className="mr-2 h-5 w-5 text-blue-500" />
                  Crear y Editar Paquetes
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Usa el botón <strong>"Nuevo Paquete"</strong> para definir un nuevo perfil o paquete. Un paquete es una colección de estudios individuales y/o otros paquetes que se ofrecen como un solo item.
                </p>
                <p className="text-sm">
                  En el formulario, puedes seleccionar qué estudios y paquetes existentes formarán parte del nuevo paquete.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5 text-green-500" />
                  Gestión de Precios de Paquetes
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  El precio de un paquete se gestiona de la misma manera que el de un estudio individual:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Precio Base (Particular):</strong> Al crear o editar un paquete, debes establecer su precio base. Este precio se aplicará al referente "Particular" y servirá como precio de lista para el público general.</li>
                  <li><strong>Precios por Referente:</strong> Para asignar precios especiales a otros médicos o instituciones, ve a la sección <strong>Gestión de Referentes</strong>, elige un referente y haz clic en "Gestionar Precios". Allí podrás establecer un precio específico para este paquete.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Edit className="mr-2 h-5 w-5 text-orange-500" />
                  Acciones en la Tabla
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                 <p className="mb-2">
                  Cada paquete en la tabla tiene botones de acción rápida:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong className="flex items-center gap-1"><Edit className="h-4 w-4 text-blue-500"/>Editar:</strong> Abre el formulario con los datos del paquete para que puedas modificar su nombre, descripción o los items que contiene.</li>
                  <li><strong className="flex items-center gap-1"><Trash2 className="h-4 w-4 text-red-500"/>Eliminar:</strong> Borra permanentemente el paquete. Esta acción no se puede deshacer y eliminará el paquete de todas las listas de precios.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PackageHelpDialog;