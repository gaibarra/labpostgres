import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { LineChart, CreditCard, FileSpreadsheet, Percent, Banknote, DollarSign, ShoppingCart, HelpCircle, FileBarChart } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from 'react-router-dom';
import FinanceHelpDialog from '@/components/modules/finance/FinanceHelpDialog';

const FinanceFeatureCard = ({ icon: Icon, title, description, comingSoon = true, path }) => {
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
        <Icon className="h-8 w-8 text-green-500 mr-4" />
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-grow">{description}</p>
      <Button onClick={handleClick} variant="outline" className="w-full border-green-500 text-green-500 hover:bg-green-500/10 hover:text-green-600 dark:hover:bg-green-500/20 dark:hover:text-green-400 mt-auto">
        {comingSoon ? "Ver Más (Próximamente)" : "Acceder"}
      </Button>
    </motion.div>
  );
};

const Finance = () => {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  const features = [
    {
      icon: LineChart,
      title: "Reporte de Ingresos",
      description: "Visualiza ingresos por periodo, referente, estudio o paciente. Genera reportes detallados.",
      comingSoon: false,
      path: "/finance/income-report"
    },
    {
      icon: ShoppingCart,
      title: "Control de Gastos",
      description: "Registra y categoriza gastos operativos, de insumos y administrativos. Analiza costos.",
      comingSoon: false, 
      path: "/finance/expense-tracking"
    },
    {
      icon: CreditCard,
      title: "Cuentas por Cobrar",
      description: "Gestiona saldos pendientes de pacientes y referentes. Envía recordatorios de pago.",
      comingSoon: false,
      path: "/finance/accounts-receivable"
    },
    {
      icon: FileSpreadsheet,
      title: "Facturación y Recibos",
      description: "Genera facturas electrónicas (CFDI) y recibos de pago. Integra con sistemas de facturación.",
      comingSoon: false,
      path: "/finance/invoicing-receipts"
    },
    {
      icon: FileBarChart,
      title: "Reporte de Facturación",
      description: "Genera reportes de facturación para instituciones, desglosando estudios por paciente y periodo.",
      comingSoon: false,
      path: "/finance/billing-report"
    },
    {
      icon: Percent,
      title: "Configuración de Impuestos",
      description: "Define tasas de impuestos aplicables y gestiona la información fiscal del laboratorio.",
      comingSoon: false,
      path: "/finance/tax-configuration"
    },
    {
      icon: Banknote,
      title: "Flujo de Caja",
      description: "Monitorea las entradas y salidas de efectivo para asegurar la liquidez del laboratorio.",
      comingSoon: false,
      path: "/finance/cash-flow"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <FinanceHelpDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800/70 p-6">
          <div className="flex flex-col sm:flex-row items-start justify-between w-full">
            <div className="flex items-center">
              <DollarSign className="h-10 w-10 mr-4 text-green-600 dark:text-green-400" />
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold text-green-700 dark:text-green-300">
                  Panel de Finanzas
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Gestiona la salud financiera de tu laboratorio con herramientas precisas.
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
              <FinanceFeatureCard
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

export default Finance;