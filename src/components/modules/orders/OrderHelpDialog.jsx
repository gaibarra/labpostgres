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
import { HelpCircle, PlusCircle, Edit3, FileEdit, FileText, FileSpreadsheet, QrCode, CheckSquare, Sparkles, Trash2, CircleDot } from 'lucide-react';

const OrderHelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-sky-600" />
            Ayuda de Gestión de Órdenes
          </DialogTitle>
          <DialogDescription>
            Guía para registrar, procesar y gestionar las órdenes de trabajo del laboratorio.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <PlusCircle className="mr-2 h-5 w-5 text-blue-500" />
                  Crear y Editar Órdenes
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Usa el botón <strong>"Nueva Orden"</strong> para registrar una nueva solicitud de estudios. En el formulario, deberás seleccionar un paciente, un médico o institución referente, y añadir los estudios o paquetes solicitados.
                </p>
                <p className="text-sm">
                  Puedes editar una orden existente haciendo clic en el menú de acciones y seleccionando "Editar Orden".
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <CircleDot className="mr-2 h-5 w-5 text-yellow-500" />
                  Estados de la Orden
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Cada orden pasa por varios estados a lo largo de su ciclo de vida:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Pendiente:</strong> La orden ha sido creada pero aún no se han tomado las muestras o no ha entrado a proceso.</li>
                  <li><strong>Procesando:</strong> Las muestras están siendo analizadas.</li>
                  <li><strong>Concluida:</strong> Todos los resultados han sido capturados y están listos para ser validados.</li>
                  <li><strong>Reportada:</strong> Los resultados han sido validados y el reporte final ha sido generado.</li>
                  <li><strong>Cancelada:</strong> La orden ha sido anulada.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Edit3 className="mr-2 h-5 w-5 text-orange-500" />
                  Acciones Principales
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                 <p className="mb-2">
                  El menú de acciones de cada orden te permite realizar varias tareas:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong className="flex items-center gap-1"><FileEdit className="h-4 w-4 text-green-500"/>Registrar Resultados:</strong> Abre la interfaz para capturar los valores de los parámetros de cada estudio en la orden.</li>
                  <li><strong className="flex items-center gap-1"><FileText className="h-4 w-4 text-blue-500"/>Ver Comprobante:</strong> Genera un recibo o comprobante de la orden para el paciente.</li>
                  <li><strong className="flex items-center gap-1"><FileSpreadsheet className="h-4 w-4 text-teal-500"/>Hoja de Trabajo:</strong> Imprime una lista de los estudios de la orden, útil para el personal del laboratorio.</li>
                  <li><strong className="flex items-center gap-1"><QrCode className="h-4 w-4 text-gray-500"/>Imprimir Etiquetas:</strong> Genera etiquetas con códigos QR para los contenedores de muestras.</li>
                  <li><strong className="flex items-center gap-1"><CheckSquare className="h-4 w-4 text-indigo-500"/>Ver Reporte Final:</strong> Una vez la orden está "Reportada", permite visualizar e imprimir el informe final de resultados.</li>
                  <li><strong className="flex items-center gap-1"><Sparkles className="h-4 w-4 text-purple-500"/>Asistente IA:</strong> Ofrece recomendaciones y análisis adicionales basados en los resultados de la orden (disponible para órdenes reportadas).</li>
                  <li><strong className="flex items-center gap-1"><Trash2 className="h-4 w-4 text-red-500"/>Eliminar Orden:</strong> Borra la orden. Esta acción no se puede realizar si la orden ya ha sido reportada.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderHelpDialog;