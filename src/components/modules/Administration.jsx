import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Users, ShieldCheck, Activity, Settings2, Briefcase, UserCog, LockKeyhole, HelpCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from 'react-router-dom';
import AdminHelpDialog from '@/components/modules/administration/AdminHelpDialog';

const AdminFeatureCard = ({ icon: Icon, title, description, comingSoon = true, path }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleClick = () => {
    if (comingSoon) {
      toast({
        title: "🚧 ¡Próximamente!",
        description: `La función "${title}" aún no está implementada, ¡pero estará disponible pronto! 🚀`,
        duration: 3000,
      });
    } else if (path) {
      navigate(path);
    } else {
       toast({
        title: "🚧 ¡Ruta no definida!",
        description: `La ruta para "${title}" no ha sido configurada.`,
        variant: "destructive",
        duration: 3000,
      });
    }
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col"
    >
      <div className="flex items-center mb-4">
        <Icon className="h-8 w-8 text-sky-500 mr-4" />
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-grow">{description}</p>
      <Button onClick={handleClick} variant="outline" className="w-full border-sky-500 text-sky-500 hover:bg-sky-500/10 hover:text-sky-600 dark:hover:bg-sky-500/20 dark:hover:text-sky-400 mt-auto">
        {comingSoon ? "Ver Más (Próximamente)" : "Acceder"}
      </Button>
    </motion.div>
  );
};

const Administration = () => {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  
  const features = [
    {
      icon: UserCog,
      title: "Gestión de Usuarios",
      description: "Administra cuentas de usuario, roles y permisos de acceso al sistema.",
      comingSoon: false,
      path: "/administration/user-management"
    },
    {
      icon: LockKeyhole, 
      title: "Roles y Permisos",
      description: "Define roles específicos y asigna permisos detallados para cada función del sistema.",
      comingSoon: false, 
      path: "/administration/roles-permissions" 
    },
    {
      icon: Activity,
      title: "Auditoría del Sistema",
      description: "Revisa logs de actividad, cambios importantes y accesos para mantener la seguridad.",
      comingSoon: false,
      path: "/administration/audit-log"
    },
    {
      icon: Settings2,
      title: "Configuración General",
      description: "Ajusta parámetros globales del sistema, integraciones y preferencias operativas.",
      comingSoon: false,
      path: "/administration/general-settings"
    },
    {
      icon: Briefcase,
      title: "Gestión de Sucursales",
      description: "Administra múltiples sucursales o puntos de servicio desde una ubicación central.",
      comingSoon: false,
      path: "/administration/branch-management"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <AdminHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800/70 p-6">
          <div className="flex flex-col sm:flex-row items-start justify-between w-full">
            <div className="flex items-center">
              <ShieldCheck className="h-10 w-10 mr-4 text-sky-600 dark:text-sky-400" />
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold text-sky-700 dark:text-sky-300">
                  Panel de Administración
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Controla y configura los aspectos fundamentales de tu laboratorio.
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setIsHelpDialogOpen(true)} className="mt-4 sm:mt-0 flex-shrink-0">
              <HelpCircle className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <AdminFeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                comingSoon={feature.comingSoon}
                path={feature.path}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default Administration;