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
import { HelpCircle, UserPlus, Edit, Trash2, Search, BarChart2, FilePlus2, Info, ShieldCheck, AlertTriangle, Keyboard, Save } from 'lucide-react';

const PatientHelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]" aria-describedby="patient-help-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-indigo-600" />
            Ayuda de Gestión de Pacientes
          </DialogTitle>
          <DialogDescription id="patient-help-dialog-description">
            Usa este panel como referencia rápida para registrar, buscar y mantener los datos de tus pacientes con precisión.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <UserPlus className="mr-2 h-5 w-5 text-blue-500" />
                  Flujo Rápido: Añadir / Editar
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-3 text-sm leading-relaxed">
                  Presiona <strong>Nuevo Paciente</strong> para abrir el formulario. El nombre se formatea automáticamente en Modo Título. Puedes editar un registro existente usando el ícono de lápiz en la tabla.
                </p>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold flex items-center gap-1"><Save className="h-4 w-4" /> Guardar</p>
                    <p>Almacena los datos y mantiene el foco en la gestión de pacientes.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold flex items-center gap-1"><FilePlus2 className="h-4 w-4" /> Guardar y Registrar Orden</p>
                    <p>Crea el paciente y salta inmediatamente al flujo de <strong>nueva orden</strong>.</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3"/> Puedes cerrar el formulario con ESC sin guardar cambios.</p>
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
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>Busca por <strong>nombre</strong>, <strong>email</strong> o <strong>número</strong>. El filtrado es reactivo (debounce ligero).</li>
                  <li>Escribe al menos 2–3 caracteres para resultados más precisos.</li>
                  <li>La paginación se mantiene al refrescar datos tras crear o eliminar.</li>
                </ul>
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
                <p className="mb-2 text-sm">Botones disponibles por paciente:</p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong className="flex items-center gap-1"><BarChart2 className="h-4 w-4"/>Historial:</strong> Abre la vista con todas las órdenes y resultados asociados.</li>
                  <li><strong className="flex items-center gap-1"><Edit className="h-4 w-4"/>Editar:</strong> Reabre el formulario con los datos precargados.</li>
                  <li><strong className="flex items-center gap-1"><Trash2 className="h-4 w-4"/>Eliminar:</strong> Solicita confirmación antes de borrar. Operación irreversible.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Info className="mr-2 h-5 w-5 text-cyan-500" />
                  Campos y Validaciones
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Obligatorios:</strong> Nombre, Fecha de Nacimiento, Sexo y Email.</li>
                  <li><strong>Formato Email:</strong> Validación básica RFC; muestra mensaje si es inválido.</li>
                  <li><strong>Nombre:</strong> Se capitaliza automáticamente (puedes corregir manualmente antes de guardar).</li>
                  <li><strong>Campos vacíos</strong> no se envían al servidor (se omiten del payload).</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Keyboard className="mr-2 h-5 w-5 text-amber-500" />
                  Atajos y Productividad
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Esc:</strong> Cierra formularios o el diálogo de ayuda.</li>
                  <li><strong>Enter</strong> dentro del formulario: equivalente a Guardar (si no hay errores).</li>
                  <li>Tras guardar un nuevo paciente puedes usar inmediatamente <em>Guardar y Registrar Orden</em> para acelerar la recepción.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <ShieldCheck className="mr-2 h-5 w-5 text-emerald-500" />
                  Privacidad y Buenas Prácticas
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>Verifica datos sensibles (email y fecha) antes de registrar.</li>
                  <li>No ingreses diagnósticos extensos en <em>Historial clínico (resumen)</em>; mantén sólo contexto breve.</li>
                  <li>Elimina pacientes sólo si es estrictamente necesario (auditoría y trazabilidad).</li>
                </ul>
                <p className="mt-3 text-xs flex items-center gap-1 text-muted-foreground"><AlertTriangle className="h-3 w-3" /> Evita copiar/pegar datos desde aplicaciones no confiables para reducir riesgo de caracteres ocultos.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientHelpDialog;