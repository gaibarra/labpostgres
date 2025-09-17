import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Megaphone, Share2, Mail, Search, BarChart2, Star, HelpCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from 'react-router-dom';
import MarketingHelpDialog from '@/components/modules/marketing/MarketingHelpDialog';

const MarketingFeatureCard = ({ icon: Icon, title, description, path }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleClick = () => {
    if (path) {
      navigate(path);
    } else {
      toast({
        title: "🚧 ¡Próximamente!",
        description: `La función "${title}" aún no está implementada, ¡pero estará disponible pronto! 🚀`,
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
        <Icon className="h-8 w-8 text-purple-500 mr-4" />
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-grow">{description}</p>
      <Button onClick={handleClick} variant="outline" className="w-full border-purple-500 text-purple-500 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:bg-purple-500/20 dark:hover:text-purple-400 mt-auto">
        Acceder
      </Button>
    </motion.div>
  );
};

const Marketing = () => {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  const features = [
    {
      icon: Megaphone,
      title: "Campañas de Publicidad",
      description: "Gestiona y monitorea tus campañas en Google Ads y Facebook Ads para atraer nuevos pacientes.",
      path: "/marketing/ad-campaigns"
    },
    {
      icon: Share2,
      title: "Gestión de Redes Sociales",
      description: "Planifica, programa y analiza el contenido de tus perfiles sociales para construir una comunidad.",
      path: "/marketing/social-media"
    },
    {
      icon: Mail,
      title: "Email Marketing",
      description: "Crea y envía campañas de correo para fidelizar pacientes y comunicar promociones.",
      path: "/marketing/email-marketing"
    },
    {
      icon: Search,
      title: "SEO y Contenido",
      description: "Optimiza tu web y crea contenido de valor para posicionarte en los motores de búsqueda.",
      path: "/marketing/seo-content"
    },
    {
      icon: BarChart2,
      title: "Analíticas y KPIs",
      description: "Mide el rendimiento de tus estrategias con indicadores clave y reportes visuales.",
      path: "/marketing/analytics-kpis"
    },
    {
      icon: Star,
      title: "Programas de Lealtad",
      description: "Diseña e implementa programas para recompensar y retener a tus pacientes más fieles.",
      path: "/marketing/loyalty-programs"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <MarketingHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800/70 p-6">
          <div className="flex flex-col sm:flex-row items-start justify-between w-full">
            <div className="flex items-center">
              <Megaphone className="h-10 w-10 mr-4 text-purple-600 dark:text-purple-400" />
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold text-purple-700 dark:text-purple-300">
                  Marketing Digital Estratégico
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Impulsa el crecimiento de tu laboratorio y conecta con más pacientes.
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
              <MarketingFeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                path={feature.path}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default Marketing;