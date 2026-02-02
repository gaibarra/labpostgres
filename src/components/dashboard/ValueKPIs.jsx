import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DollarSign,
    TrendingUp,
    Clock,
    Trophy,
    Sparkles
} from 'lucide-react';

/**
 * Panel de KPIs de valor agregado
 * @param {Object} props
 * @param {Object} props.stats - Estadísticas del hook useDashboardStats
 * @param {boolean} props.isLoading - Estado de carga
 */
export function ValueKPIs({ stats = {}, isLoading = false }) {
    const {
        revenueToday = 0,
        revenueWeek = 0,
        avgDeliveryTimeHours,
        conversionRate = 0,
        topStudies = []
    } = stats;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatTime = (hours) => {
        if (hours === null || hours === undefined) return '—';
        const h = parseFloat(hours);
        if (h < 1) return `${Math.round(h * 60)} min`;
        if (h < 24) return `${h.toFixed(1)} hrs`;
        return `${(h / 24).toFixed(1)} días`;
    };

    const kpis = [
        {
            id: 'revenue-today',
            title: 'Ingresos Hoy',
            value: formatCurrency(revenueToday),
            icon: DollarSign,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
        },
        {
            id: 'revenue-week',
            title: 'Ingresos Semana',
            value: formatCurrency(revenueWeek),
            icon: TrendingUp,
            color: 'text-sky-500',
            bgColor: 'bg-sky-50 dark:bg-sky-900/20'
        },
        {
            id: 'delivery-time',
            title: 'Tiempo Promedio',
            value: formatTime(avgDeliveryTimeHours),
            subtitle: 'de entrega',
            icon: Clock,
            color: 'text-amber-500',
            bgColor: 'bg-amber-50 dark:bg-amber-900/20'
        },
        {
            id: 'conversion',
            title: 'Tasa Conversión',
            value: `${conversionRate}%`,
            subtitle: 'completadas',
            icon: Trophy,
            color: 'text-violet-500',
            bgColor: 'bg-violet-50 dark:bg-violet-900/20'
        }
    ];

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-base">
                        <Sparkles className="mr-2 h-5 w-5 text-amber-500" />
                        Métricas de Valor
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800 p-4">
                                <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
                                <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-slate-200/70 dark:border-slate-700/60">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center">
                        <Sparkles className="mr-2 h-5 w-5 text-amber-500" />
                        Métricas de Valor
                    </span>
                    {topStudies.length > 0 && (
                        <span className="text-xs font-normal text-muted-foreground">
                            Top: {topStudies[0]?.study_name?.slice(0, 20) || '—'}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {kpis.map((kpi, idx) => (
                        <motion.div
                            key={kpi.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1, duration: 0.3 }}
                            className={`rounded-xl p-4 ${kpi.bgColor}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    {kpi.title}
                                </span>
                                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                            </div>
                            <div className="text-xl font-bold text-slate-900 dark:text-slate-50">
                                {kpi.value}
                            </div>
                            {kpi.subtitle && (
                                <div className="text-xs text-muted-foreground">
                                    {kpi.subtitle}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Top estudios */}
                {topStudies.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                            Estudios más solicitados (último mes)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {topStudies.slice(0, 5).map((study, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                                >
                                    {study.study_name?.slice(0, 25) || 'Sin nombre'}
                                    <span className="ml-1.5 text-slate-500">{study.count}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default ValueKPIs;
