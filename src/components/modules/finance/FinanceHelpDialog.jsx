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
import { HelpCircle, LineChart, ShoppingCart, CreditCard, FileSpreadsheet, Percent, Banknote, FileBarChart } from 'lucide-react';

const FinanceHelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-green-600" />
            Ayuda del Panel de Finanzas
          </DialogTitle>
          <DialogDescription>
            Guía sobre los módulos para la gestión financiera de tu laboratorio.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <LineChart className="mr-2 h-5 w-5 text-blue-500" />
                  Reporte de Ingresos
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Analiza los ingresos de tu laboratorio. Puedes filtrar por fechas, estudios, pacientes o referentes para entender qué áreas son las más rentables. Genera reportes gráficos y detallados para la toma de decisiones.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <ShoppingCart className="mr-2 h-5 w-5 text-orange-500" />
                  Control de Gastos
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Registra todos los gastos del laboratorio, desde la compra de reactivos hasta los pagos de servicios. Categoriza cada gasto para tener una visión clara de en qué se está invirtiendo el dinero y optimizar costos.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5 text-red-500" />
                  Cuentas por Cobrar
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Lleva un control preciso de las deudas de pacientes y empresas. El sistema te muestra los saldos pendientes, los días de mora y te permite registrar pagos parciales o totales.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <FileSpreadsheet className="mr-2 h-5 w-5 text-teal-500" />
                  Facturación y Recibos
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Genera recibos de pago para tus pacientes y gestiona la facturación electrónica (CFDI en México, por ejemplo). Este módulo se puede integrar con proveedores de facturación autorizados para automatizar el proceso.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <FileBarChart className="mr-2 h-5 w-5 text-indigo-500" />
                  Reporte de Facturación
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Crea reportes detallados para facturar a instituciones. Filtra por institución y rango de fechas para obtener un desglose de todos los estudios realizados por cada paciente, con sus costos y un total general, listo para exportar a PDF.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Percent className="mr-2 h-5 w-5 text-purple-500" />
                  Configuración de Impuestos
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Define los impuestos aplicables a tus servicios (como el IVA). El sistema calculará automáticamente los montos correspondientes en cada orden de trabajo y factura.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Banknote className="mr-2 h-5 w-5 text-green-500" />
                  Flujo de Caja
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Monitorea en tiempo real el dinero que entra y sale de tu laboratorio. Esta herramienta es fundamental para asegurar que siempre tengas la liquidez necesaria para cubrir tus operaciones diarias y planificar inversiones.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FinanceHelpDialog;