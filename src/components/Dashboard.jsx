import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Settings, Users, TestTube as TestTubeDiagonal, Package, ClipboardList, ShieldCheck, DollarSign, Target } from 'lucide-react';

const modules = [
  { name: 'Configuración', path: '/settings', icon: Settings, description: 'Variables del laboratorio, logo, API Keys.' },
  { name: 'Pacientes', path: '/patients', icon: Users, description: 'Datos generales y antecedentes clínicos.' },
  { name: 'Referentes', path: '/referrers', icon: Users, description: 'Médicos, instituciones, particulares.' },
  { name: 'Estudios', path: '/studies', icon: TestTubeDiagonal, description: 'Catálogo y valores de referencia.' },
  { name: 'Paquetes', path: '/packages', icon: Package, description: 'Agrupación de estudios y precios.' },
  { name: 'Órdenes', path: '/orders', icon: ClipboardList, description: 'Gestión de órdenes de trabajo.' },
  { name: 'Administración', path: '/administration', icon: ShieldCheck, description: 'Actualización de catálogos.' },
  { name: 'Finanzas', path: '/finance', icon: DollarSign, description: 'Costos, ingresos, reportes.' },
  { name: 'Marketing', path: '/marketing', icon: Target, description: 'Seguimiento de leads.' },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Panel Principal</h1>
        <p className="text-muted-foreground">Bienvenido al sistema de administración de laboratorio clínico.</p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod, index) => (
          <motion.div
            key={mod.path}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Link to={mod.path} className="block hover:no-underline">
              <Card className="h-full hover:shadow-lg transition-shadow duration-300 ease-in-out transform hover:-translate-y-1 glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium text-sky-600 dark:text-sky-400">{mod.name}</CardTitle>
                  <mod.icon className="h-6 w-6 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{mod.description}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;