import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Plus,
    UserPlus,
    FileText,
    Search,
    BarChart3,
    ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const quickActions = [
    {
        id: 'new-order',
        label: 'Nueva Orden',
        icon: FileText,
        to: '/orders?action=new',
        color: 'bg-sky-500 hover:bg-sky-600',
        description: 'Crear orden de trabajo'
    },
    {
        id: 'new-patient',
        label: 'Nuevo Paciente',
        icon: UserPlus,
        to: '/patients?action=new',
        color: 'bg-emerald-500 hover:bg-emerald-600',
        description: 'Registrar paciente'
    },
    {
        id: 'search-order',
        label: 'Buscar Orden',
        icon: Search,
        to: '/orders',
        color: 'bg-violet-500 hover:bg-violet-600',
        description: 'Por folio o paciente'
    },
    {
        id: 'reports',
        label: 'Reportes',
        icon: BarChart3,
        to: '/finance/income-report',
        color: 'bg-amber-500 hover:bg-amber-600',
        description: 'Ver reportes financieros'
    }
];

/**
 * Panel de acciones rápidas para el Dashboard
 * @param {Object} props
 * @param {string} [props.userRole] - Rol del usuario para filtrar acciones
 */
export function QuickActions({ userRole }) {
    // Filtrar acciones según rol si es necesario
    const visibleActions = quickActions.filter(action => {
        // Admin ve todo
        if (userRole === 'Admin' || userRole === 'admin') return true;
        // Laboratorista no ve reportes financieros
        if (userRole === 'Laboratorista' && action.id === 'reports') return false;
        return true;
    });

    return (
        <Card className="border-slate-200/70 dark:border-slate-700/60">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-base font-semibold text-slate-700 dark:text-slate-200">
                    <ClipboardList className="mr-2 h-5 w-5 text-indigo-500" />
                    Acciones Rápidas
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {visibleActions.map((action, idx) => (
                        <motion.div
                            key={action.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05, duration: 0.2 }}
                        >
                            <Button
                                asChild
                                variant="ghost"
                                className={`
                  h-auto w-full flex-col gap-2 p-4 
                  text-white ${action.color}
                  shadow-sm hover:shadow-md transition-all
                  rounded-xl
                `}
                            >
                                <Link to={action.to}>
                                    <action.icon className="h-6 w-6" />
                                    <span className="text-sm font-medium">{action.label}</span>
                                    <span className="text-xs opacity-80">{action.description}</span>
                                </Link>
                            </Button>
                        </motion.div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export default QuickActions;
