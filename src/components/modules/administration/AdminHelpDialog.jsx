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
import { HelpCircle, UserCog, LockKeyhole, Activity, Settings2, Briefcase } from 'lucide-react';

const AdminHelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <HelpCircle className="mr-2 h-6 w-6 text-sky-600" />
            Ayuda del Panel de Administración
          </DialogTitle>
          <DialogDescription>
            Guía sobre los módulos de configuración y control del sistema.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <UserCog className="mr-2 h-5 w-5 text-blue-500" />
                  Gestión de Usuarios
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  En esta sección puedes crear, editar y eliminar las cuentas de usuario de tu equipo. Asigna roles a cada usuario para controlar su nivel de acceso a las diferentes funciones del sistema.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <LockKeyhole className="mr-2 h-5 w-5 text-purple-500" />
                  Roles y Permisos
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Define roles personalizados (como "Recepcionista", "Químico", "Administrador") y asigna permisos específicos a cada uno. Esto te permite tener un control granular sobre quién puede ver, crear, editar o eliminar información.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Activity className="mr-2 h-5 w-5 text-red-500" />
                  Auditoría del Sistema
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Aquí puedes rastrear todas las acciones importantes realizadas en el sistema: quién creó una orden, quién modificó un resultado, quién accedió a la configuración, etc. Es una herramienta clave para la seguridad y el control de calidad.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Settings2 className="mr-2 h-5 w-5 text-green-500" />
                  Configuración General
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Este es el centro de control de tu laboratorio. Configura la información de tu empresa, ajusta el diseño de los reportes, establece la moneda local, configura impuestos y gestiona integraciones con otros sistemas.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center">
                  <Briefcase className="mr-2 h-5 w-5 text-indigo-500" />
                  Gestión de Sucursales
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <p>
                  Si tu laboratorio tiene múltiples sedes o puntos de toma de muestra, aquí puedes administrarlos todos. Define la información de cada sucursal y configura un prefijo de folio único para cada una, manteniendo las operaciones organizadas.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminHelpDialog;