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
import { HelpCircle, Megaphone, Share2, Mail, Search, BarChart2, Star } from 'lucide-react';

const MarketingHelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-purple-600" />
            Ayuda de Marketing Digital
          </DialogTitle>
          <DialogDescription>
            Guía completa sobre el flujo de trabajo para hacer crecer tu laboratorio.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Megaphone className="mr-2 h-5 w-5 text-blue-500" />
                  Campañas de Publicidad
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="font-semibold mb-2">Objetivo: Atraer nuevos pacientes activamente.</p>
                <p><strong>Flujo de Trabajo:</strong></p>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                  <li><strong>Estrategia (Fuera de la app):</strong> Define tu público objetivo (ej. personas de 30-50 años interesadas en salud preventiva) y tu presupuesto mensual.</li>
                  <li><strong>Creación (En Google/Facebook Ads):</strong> Crea anuncios atractivos con un llamado a la acción claro (ej. "Agenda tu chequeo anual con 20% de descuento").</li>
                  <li><strong>Gestión (Dentro de la app):</strong> Usa este módulo para vincular tus campañas. Aquí podrás ver un resumen del rendimiento: cuántas personas ven tus anuncios y cuántas agendan una cita gracias a ellos.</li>
                  <li><strong>Optimización:</strong> Revisa qué anuncios funcionan mejor y ajusta tu estrategia para obtener más pacientes por menos inversión.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Share2 className="mr-2 h-5 w-5 text-green-500" />
                  Gestión de Redes Sociales
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="font-semibold mb-2">Objetivo: Construir una comunidad y mantener tu marca visible.</p>
                <p><strong>Flujo de Trabajo:</strong></p>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                  <li><strong>Planificación (Fuera de la app):</strong> Crea un calendario de contenido. Piensa en temas útiles: consejos de salud, explicación de estudios, presentación del personal, etc.</li>
                  <li><strong>Creación (Dentro de la app):</strong> Usa este módulo para escribir y programar tus publicaciones para Facebook, Instagram, etc. Puedes prepararlas para toda la semana o el mes.</li>
                  <li><strong>Publicación:</strong> La app publicará automáticamente el contenido en la fecha y hora programadas.</li>
                  <li><strong>Análisis:</strong> Revisa las métricas de interacción (likes, comentarios) para entender qué contenido le gusta más a tu audiencia.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Mail className="mr-2 h-5 w-5 text-orange-500" />
                  Email Marketing
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="font-semibold mb-2">Objetivo: Fidelizar pacientes existentes y comunicar novedades.</p>
                <p><strong>Flujo de Trabajo:</strong></p>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                  <li><strong>Recopilación de Datos:</strong> El sistema automáticamente añade a los pacientes a tu lista de suscriptores (siempre con su consentimiento).</li>
                  <li><strong>Segmentación (Dentro de la app):</strong> Crea listas específicas. Por ejemplo, una lista de pacientes que no han visitado el laboratorio en el último año.</li>
                  <li><strong>Creación de Campañas:</strong> Diseña correos con promociones, recordatorios de chequeos anuales o boletines informativos sobre salud.</li>
                  <li><strong>Envío y Análisis:</strong> Envía las campañas y luego analiza las tasas de apertura y clics para ver qué tan efectivos fueron tus correos.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Search className="mr-2 h-5 w-5 text-red-500" />
                  SEO y Contenido
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="font-semibold mb-2">Objetivo: Que te encuentren en Google cuando busquen servicios de laboratorio.</p>
                <p><strong>Flujo de Trabajo:</strong></p>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                  <li><strong>Investigación de Palabras Clave (Fuera de la app):</strong> Piensa cómo te buscarían tus pacientes (ej. "laboratorio de análisis clínicos cerca de mí", "precio de biometría hemática").</li>
                  <li><strong>Creación de Contenido (Dentro de la app):</strong> Escribe artículos para un blog o páginas en tu sitio web respondiendo a esas búsquedas. Por ejemplo, un artículo sobre "Para qué sirve un perfil tiroideo".</li>
                  <li><strong>Optimización Técnica:</strong> Este módulo te ayudará a revisar que tu sitio web sea rápido y fácil de usar en celulares, factores clave para Google.</li>
                  <li><strong>Monitoreo:</strong> Sigue tu posición en Google para las palabras clave más importantes y ajusta tu contenido.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <BarChart2 className="mr-2 h-5 w-5 text-indigo-500" />
                  Analíticas y KPIs
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="font-semibold mb-2">Objetivo: Medir el éxito de todas tus acciones de marketing.</p>
                <p><strong>Flujo de Trabajo:</strong></p>
                <p>Este módulo es transversal. No requiere una acción inicial, sino que se alimenta de los demás.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                  <li><strong>Visualización Centralizada:</strong> En lugar de ir a Google, Facebook y tu plataforma de email por separado, aquí verás los datos más importantes en un solo lugar.</li>
                  <li><strong>Indicadores Clave (KPIs):</strong> Monitorea métricas como "Costo por Adquisición de Paciente" (cuánto inviertes para conseguir un nuevo paciente) o "Tasa de Retención".</li>
                  <li><strong>Toma de Decisiones:</strong> Usa estos datos para decidir dónde invertir más tiempo y dinero. Si el email marketing te trae pacientes leales a bajo costo, ¡poténcialo!</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Star className="mr-2 h-5 w-5 text-yellow-500" />
                  Programas de Lealtad
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p className="font-semibold mb-2">Objetivo: Recompensar a tus pacientes recurrentes y convertirlos en promotores.</p>
                <p><strong>Flujo de Trabajo:</strong></p>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                  <li><strong>Diseño del Programa (Dentro de la app):</strong> Define las reglas. Por ejemplo, "Acumula 5 visitas y obtén un 50% de descuento en la sexta" o "Trae a un amigo y ambos reciben un 15% de descuento".</li>
                  <li><strong>Implementación:</strong> El sistema registrará automáticamente las visitas de cada paciente y les asignará los beneficios cuando cumplan las condiciones.</li>
                  <li><strong>Comunicación:</strong> Usa el módulo de Email Marketing para informar a tus pacientes sobre el programa de lealtad y recordarles sus beneficios.</li>
                  <li><strong>Análisis:</strong> Mide cuántos pacientes participan y el impacto que tiene en la frecuencia de sus visitas.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MarketingHelpDialog;