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
import { HelpCircle, Beaker, Sparkles, DollarSign, Edit, Trash2, Tag } from 'lucide-react';

const StudyHelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-sky-600" />
            Ayuda del Catálogo de Estudios
          </DialogTitle>
          <DialogDescription>
            Guía para crear, configurar y administrar los estudios clínicos de tu laboratorio.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Beaker className="mr-2 h-5 w-5 text-blue-500" />
                  Añadir y Editar Estudios
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Usa el botón <strong>"Nuevo Estudio"</strong> para abrir el formulario de registro. Aquí puedes definir todos los detalles de un estudio, desde su nombre y categoría hasta los parámetros específicos que se medirán y sus valores de referencia.
                </p>
                <p className="text-sm">
                  Puedes añadir múltiples parámetros a cada estudio y, para cada parámetro, múltiples rangos de referencia según sexo y edad.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
                  Asistente de IA
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  El botón <strong>"Asistencia IA"</strong> te permite generar automáticamente la estructura de un estudio. Simplemente introduce el nombre del estudio (ej. "Biometría Hemática") y la IA creará:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Una descripción e indicaciones para el paciente.</li>
                  <li>Los parámetros clínicos más comunes asociados.</li>
                  <li>Valores de referencia estándar para cada parámetro.</li>
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  <strong>Nota:</strong> Esta función requiere una clave de API de OpenAI configurada en la sección de Administración.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5 text-green-500" />
                  Gestión de Precios
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  El sistema de precios es flexible y se basa en el referente "Particular":
                </p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Precio Base (Particular):</strong> El precio que defines en el formulario del estudio se asigna automáticamente al referente "Particular". Este es el precio de lista o al público general.</li>
                  <li><strong className="flex items-center gap-1"><Tag className="h-4 w-4"/>Asignar Precios:</strong> Usa este botón en la tabla para abrir una ventana donde puedes asignar precios diferentes para este estudio a otros referentes (médicos, empresas, etc.), creando así listas de precios personalizadas.</li>
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
                  Cada estudio en la tabla tiene botones de acción rápida:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong className="flex items-center gap-1"><Tag className="h-4 w-4 text-teal-500"/>Asignar Precios:</strong> Abre la ventana para gestionar precios por referente.</li>
                  <li><strong className="flex items-center gap-1"><Edit className="h-4 w-4 text-blue-500"/>Editar:</strong> Abre el formulario con los datos del estudio para que puedas modificarlos.</li>
                  <li><strong className="flex items-center gap-1"><Trash2 className="h-4 w-4 text-red-500"/>Eliminar:</strong> Borra permanentemente el estudio. Esta acción no se puede deshacer.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudyHelpDialog;