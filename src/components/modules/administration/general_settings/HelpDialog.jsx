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
import { HelpCircle, Info, FileText, Palette, MapPin, Share2 } from 'lucide-react';

const HelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-indigo-600" />
            Ayuda de Configuración General
          </DialogTitle>
          <DialogDescription>
            Aquí encontrarás una guía rápida sobre cada sección de la configuración.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Info className="mr-2 h-5 w-5 text-blue-500" />
                  Información del Laboratorio
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Esta sección es para los datos fundamentales de tu laboratorio.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><strong>Información General y Fiscal:</strong> Nombre comercial, razón social, RFC y logo. Estos datos aparecerán en facturas y reportes.</li>
                  <li><strong>Dirección Fiscal:</strong> Domicilio completo registrado ante las autoridades fiscales.</li>
                  <li><strong>Contacto y Responsable Sanitario:</strong> Datos de contacto públicos y la información del profesional que avala los resultados.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-green-500" />
                  Configuración de Reportes
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Personaliza la apariencia y el contenido de los reportes de resultados que entregas a pacientes y médicos.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><strong>Formatos de Fecha y Hora:</strong> Elige cómo se mostrarán las fechas y horas en todos los documentos.</li>
                  <li><strong>Encabezado y Pie de Página:</strong> Define textos por defecto que aparecerán en todos tus reportes, como promociones, avisos de privacidad o datos de contacto adicionales.</li>
                  <li><strong>Mostrar Logo:</strong> Activa o desactiva la inclusión del logo de tu laboratorio en los reportes.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Palette className="mr-2 h-5 w-5 text-purple-500" />
                  Preferencias de Interfaz
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Ajusta la experiencia de uso de la aplicación para que se adapte a tu flujo de trabajo.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><strong>Densidad de Tablas:</strong> Cambia la cantidad de información visible en las tablas (más filas vs. más espacio).</li>
                  <li><strong>Duración de Notificaciones:</strong> Define cuántos segundos permanecerán visibles las notificaciones emergentes.</li>
                  <li><strong>Guardado Automático:</strong> Habilita el guardado de borradores para no perder información en formularios largos.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <MapPin className="mr-2 h-5 w-5 text-orange-500" />
                  Configuración Regional
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Define los estándares monetarios y de zona horaria para tu operación.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><strong>Símbolo y Código de Moneda:</strong> Establece el símbolo (ej. $, €) y el código internacional (ej. MXN, USD) para todos los precios y transacciones.</li>
                  <li><strong>Zona Horaria:</strong> La zona horaria está fijada por el sistema para garantizar la consistencia en todos los registros de fecha y hora.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Share2 className="mr-2 h-5 w-5 text-red-500" />
                  Integraciones y API Keys
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="mb-2">
                  Conecta la aplicación con servicios externos para ampliar sus capacidades.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><strong>APIs de IA:</strong> Ingresa tus claves de servicios como OpenAI para activar asistentes inteligentes.</li>
                  <li><strong>Email y WhatsApp:</strong> Configura tus proveedores para enviar notificaciones y resultados de forma automática.</li>
                  <li><strong>Telegram:</strong> Conecta un bot para recibir alertas o enviar mensajes.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpDialog;