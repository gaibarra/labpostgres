import React, { useState, useMemo } from 'react';
    import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
    import { format, startOfDay, endOfDay } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { apiClient } from '@/lib/apiClient';

    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import SearchableSelect from '@/components/ui/SearchableSelect';
    import { DatePickerWithRange } from '@/components/ui/datepicker';
    import { Loader2, Filter, BarChart2, AlertCircle, PieChart as PieChartIcon, LineChart as LineChartIcon, Banknote } from 'lucide-react';
    import { useToast } from "@/components/ui/use-toast";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { toISOStringWithTimeZone } from '@/lib/dateUtils';

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

    const IncomeReport = () => {
        const [dateRange, setDateRange] = useState({ from: new Date(new Date().setMonth(new Date().getMonth() - 1)), to: new Date() });
        const [groupBy, setGroupBy] = useState('all');
        const [reportData, setReportData] = useState(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState(null);
        const { toast } = useToast();

        const handleGenerateReport = async () => {
            setLoading(true);
            setError(null);
            setReportData(null);

            if (!dateRange.from || !dateRange.to) {
                toast({ title: 'Error', description: 'Por favor, selecciona un rango de fechas.', variant: 'destructive' });
                setLoading(false);
                return;
            }

            try {
                const startDate = toISOStringWithTimeZone(startOfDay(dateRange.from));
                const endDate = toISOStringWithTimeZone(endOfDay(dateRange.to));

                const data = await apiClient.get(`/finance/income-report?from=${encodeURIComponent(startDate)}&to=${encodeURIComponent(endDate)}&status=Reportada,Concluida`);
                setReportData(data || []);
                toast({ title: 'Reporte Generado', description: `Se encontraron ${(data||[]).length} órdenes completadas.` });

            } catch (err) {
                console.error("Error generating report:", err);
                setError(err.message);
                toast({ title: 'Error al generar reporte', description: err.message, variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };
        
        const { totalIncome, chartData } = useMemo(() => {
            if (!reportData) return { totalIncome: 0, chartData: [] };
            const toNumber = (v) => {
                const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0').replace(/[,\s]/g, ''));
                return Number.isFinite(n) ? n : 0;
            };
            const total = reportData.reduce((acc, order) => acc + toNumber(order.total_price), 0);

            let groupedData = {};
            if (groupBy === 'all') {
                groupedData = { 'Todas las Órdenes': reportData.reduce((acc, order) => acc + toNumber(order.total_price), 0) };
            } else if (groupBy === 'day') {
                reportData.forEach(order => {
                    const day = format(new Date(order.order_date), 'yyyy-MM-dd');
                    if (!groupedData[day]) groupedData[day] = 0;
                    groupedData[day] += toNumber(order.total_price);
                });
            } else if (groupBy === 'referrer') {
                reportData.forEach(order => {
                    const referrerName = order.referrer_name || order.referrer?.name || 'Sin Referente';
                    if (!groupedData[referrerName]) groupedData[referrerName] = 0;
                    groupedData[referrerName] += toNumber(order.total_price);
                });
            } else if (groupBy === 'patient') {
                reportData.forEach(order => {
                    const patientName = order.patient_name || order.patient?.full_name || 'Paciente Anónimo';
                    if (!groupedData[patientName]) groupedData[patientName] = 0;
                    groupedData[patientName] += toNumber(order.total_price);
                });
            }
            
            const finalChartData = Object.entries(groupedData).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

            return { totalIncome: total, chartData: finalChartData };
        }, [reportData, groupBy]);

        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center text-xl font-bold text-gray-700">
                            <Banknote className="mr-3 h-6 w-6 text-green-600" />
                            Reporte de Ingresos
                        </CardTitle>
                        <p className="text-sm text-gray-500">Analiza tus ingresos detalladamente por diferentes criterios y periodos.</p>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center text-lg">
                            <Filter className="mr-2 h-5 w-5"/> Filtros del Reporte
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium">Rango de Fechas</label>
                            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                        </div>
                                                <div className="flex flex-col space-y-2">
                                                         <label className="text-sm font-medium">Agrupar Por</label>
                                                         <SearchableSelect
                                                             options={[
                                                                 {value:'all',label:'Todas las Órdenes'},
                                                                 {value:'day',label:'Día'},
                                                                 {value:'referrer',label:'Referente'},
                                                                 {value:'patient',label:'Paciente'}
                                                             ]}
                                                             value={groupBy}
                                                             onValueChange={setGroupBy}
                                                             placeholder="Seleccionar agrupación"
                                                             searchPlaceholder="Buscar opción..."
                                                             notFoundMessage="Sin opciones"
                                                         />
                                                </div>
                        <div className="flex items-end">
                            <Button onClick={handleGenerateReport} disabled={loading} className="w-full md:w-auto">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Generar Reporte
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {loading && (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                    </div>
                )}
                
                {error && (
                     <Card className="bg-red-50 border-red-200">
                        <CardContent className="pt-6">
                            <div className="flex items-center text-red-600">
                                <AlertCircle className="mr-2 h-5 w-5" />
                                <p><span className="font-bold">Error:</span> {error}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {reportData && (
                    <div className="space-y-6">
                        <Card>
                             <CardHeader>
                                <CardTitle className="text-lg">Visualización del Reporte</CardTitle>
                                <p className="text-sm text-gray-500">
                                    Total de Ingresos en el periodo: <span className="font-bold text-green-600">${totalIncome.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="font-semibold mb-4 flex items-center"><BarChart2 className="mr-2 h-5 w-5 text-blue-500" />Ingresos por {groupBy === 'day' ? 'Día' : groupBy === 'referrer' ? 'Referente' : 'Agrupación'}</h3>
                                        <ResponsiveContainer width="100%" height={400}>
                                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString('es-MX')}`} />
                                                <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                                                <Tooltip formatter={(value) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />
                                                <Legend />
                                                <Bar dataKey="value" name="Ingresos" fill="#3b82f6" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-4 flex items-center"><PieChartIcon className="mr-2 h-5 w-5 text-purple-500" />Distribución de Ingresos</h3>
                                        <ResponsiveContainer width="100%" height={400}>
                                            <PieChart>
                                                <Pie
                                                    data={chartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    outerRadius={150}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                    nameKey="name"
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                {groupBy === 'day' && (
                                     <div className="mt-8">
                                        <h3 className="font-semibold mb-4 flex items-center"><LineChartIcon className="mr-2 h-5 w-5 text-teal-500" />Tendencia de Ingresos Diarios</h3>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={chartData.sort((a, b) => new Date(a.name) - new Date(b.name))}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" tickFormatter={(str) => format(new Date(str), 'MMM d', { locale: es })} />
                                                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                                <Tooltip formatter={(value) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />
                                                <Legend />
                                                <Line type="monotone" dataKey="value" name="Ingresos" stroke="#14b8a6" strokeWidth={2} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                <div className="mt-8">
                                    <h3 className="font-semibold mb-4">Detalle de Órdenes</h3>
                                    <div className="max-h-[400px] overflow-auto border rounded-md">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                                                <TableRow>
                                                    <TableHead>Folio</TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Paciente</TableHead>
                                                    <TableHead>Referente</TableHead>
                                                    <TableHead className="text-right">Monto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reportData.map(order => (
                                                    <TableRow key={order.id || order.folio}>
                                                        <TableCell className="font-mono">{order.folio || order.id}</TableCell>
                                                        <TableCell>{format(new Date(order.order_date), 'dd/MM/yyyy')}</TableCell>
                                                        <TableCell>{order.patient_name || order.patient?.full_name || 'N/A'}</TableCell>
                                                        <TableCell>{order.referrer_name || order.referrer?.name || 'N/A'}</TableCell>
                                                        <TableCell className="text-right">${(typeof order.total_price === 'number' ? order.total_price : parseFloat(String(order.total_price ?? '0').replace(/[,\s]/g, '')) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

            </div>
        );
    };

    export default IncomeReport;