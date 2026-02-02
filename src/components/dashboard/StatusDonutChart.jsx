import React from 'react';
import { useLazyRecharts } from '@/hooks/useLazyRecharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieChartIcon } from 'lucide-react';

/**
 * Gráfico de dona mostrando distribución de estados de órdenes
 * @param {Object} props
 * @param {Array} props.data - Array de { name, value, color }
 * @param {number} props.total - Total de órdenes
 * @param {string} props.period - Periodo (ej: "30 días")
 * @param {boolean} props.isLoading - Estado de carga
 */
export function StatusDonutChart({ data = [], total = 0, period = '30 días', isLoading = false }) {
    const { recharts, isLoading: isChartLibLoading, error: chartLibError } = useLazyRecharts();

    if (isChartLibLoading || isLoading) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-base">
                        <PieChartIcon className="mr-2 h-5 w-5 text-indigo-500" />
                        Estados de Órdenes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-48 items-center justify-center">
                        <div className="h-32 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (chartLibError || !recharts) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-base">
                        <PieChartIcon className="mr-2 h-5 w-5 text-indigo-500" />
                        Estados de Órdenes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-48 items-center justify-center text-sm text-red-500">
                        No se pudo cargar el gráfico
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } = recharts;

    // Si no hay datos
    if (!data.length || total === 0) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-base">
                        <PieChartIcon className="mr-2 h-5 w-5 text-indigo-500" />
                        Estados de Órdenes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                        <PieChartIcon className="mb-2 h-12 w-12 opacity-20" />
                        <p className="text-sm">Sin órdenes en los últimos {period}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center">
                        <PieChartIcon className="mr-2 h-5 w-5 text-indigo-500" />
                        Estados de Órdenes
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                        {total} órdenes • {period}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) =>
                                percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                            }
                            labelLine={false}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                borderColor: 'hsl(var(--border))',
                                borderRadius: '8px'
                            }}
                            formatter={(value, name) => [`${value} órdenes`, name]}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => (
                                <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

export default StatusDonutChart;
