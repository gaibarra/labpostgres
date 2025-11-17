import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/datepicker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from 'framer-motion';
import { Banknote, ArrowUpCircle, ArrowDownCircle, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format, startOfDay, endOfDay, eachDayOfInterval, parseISO } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useLazyRecharts } from '@/hooks/useLazyRecharts';

const CashFlow = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: new Date(new Date().setDate(new Date().getDate() - 30)), to: new Date() });
  const [transactions, setTransactions] = useState([]);
  const { recharts, isLoading: isChartLibLoading, error: chartLibError } = useLazyRecharts();
  
  const fetchTransactions = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);

    const fromDate = format(startOfDay(dateRange.from), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    const toDate = format(endOfDay(dateRange.to), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

    try {
      // Fetch receivables (paid and pending) then map payments; placeholder future dedicated payments endpoint.
      const receivables = await apiClient.get(`/finance/receivables?from=${fromDate}&to=${toDate}&status=paid`);
      const payments = [];
      (receivables||[]).forEach(o => {
        if (o.paid_amount && o.paid_amount > 0 && o.total_price) {
          payments.push({ payment_date: o.order_date, amount: o.paid_amount, notes: 'Pago consolidado', folio: o.folio });
        }
      });
      // Expenses endpoint not yet implemented: using empty list for now.
      const expenses = [];

      const inflows = payments.map(p => ({
        date: p.payment_date,
        type: 'income',
        description: `Pago Orden ${p.folio || 'N/A'} - ${p.notes || ''}`,
        amount: p.amount
      }));

      const outflows = expenses.map(e => ({
        date: e.expense_date,
        type: 'expense',
        description: e.description,
        amount: e.amount
      }));

      const allTransactions = [...inflows, ...outflows].sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(allTransactions);

    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar las transacciones.", variant: "destructive" });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, toast]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const { totalIncome, totalExpenses, netCashFlow, chartData } = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const net = income - expenses;

    const data = {};
    if (dateRange && dateRange.from && dateRange.to) {
      const interval = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      interval.forEach(day => {
        const formattedDate = format(day, 'dd/MM');
        data[formattedDate] = { date: formattedDate, Ingresos: 0, Gastos: 0 };
      });

      transactions.forEach(t => {
        const formattedDate = format(parseISO(t.date), 'dd/MM');
        if (data[formattedDate]) {
          if (t.type === 'income') {
            data[formattedDate].Ingresos += t.amount;
          } else {
            data[formattedDate].Gastos += t.amount;
          }
        }
      });
    }

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netCashFlow: net,
      chartData: Object.values(data)
    };
  }, [transactions, dateRange]);

  const formatCurrency = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

  const renderCashFlowChart = () => {
    if (isChartLibLoading) {
      return (
        <div className="flex h-[300px] w-full items-center justify-center text-muted-foreground">
          Cargando gráficas...
        </div>
      );
    }
    if (chartLibError || !recharts) {
      return (
        <div className="flex h-[300px] w-full items-center justify-center text-center text-sm text-red-500">
          No se pudo cargar la librería de gráficas.
        </div>
      );
    }
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = recharts;
    return (
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.3)" />
          <XAxis dataKey="date" />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #ccc' }} />
          <Legend />
          <Line type="monotone" dataKey="Ingresos" stroke="#22c55e" strokeWidth={2} />
          <Line type="monotone" dataKey="Gastos" stroke="#ef4444" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/70 dark:via-indigo-900/70 dark:to-purple-900/70 p-6">
          <div className="flex items-center">
            <Banknote className="h-10 w-10 mr-4 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                Flujo de Caja
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Monitorea las entradas y salidas de efectivo de tu laboratorio.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="md:w-auto" disabled={isLoading} />
            <Button onClick={fetchTransactions} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Actualizar
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-green-50 dark:bg-green-900/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">Ingresos Totales</CardTitle>
                <ArrowUpCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(totalIncome)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-900/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200">Gastos Totales</CardTitle>
                <ArrowDownCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(totalExpenses)}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-900/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">Flujo de Caja Neto</CardTitle>
                <Banknote className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-600 dark:text-orange-400'}`}>{formatCurrency(netCashFlow)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-slate-700 dark:text-slate-200">Evolución del Flujo de Caja</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 300 }}>
                {renderCashFlowChart()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-slate-700 dark:text-slate-200">Detalle de Transacciones</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
              ) : transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t, index) => (
                        <TableRow key={index}>
                          <TableCell>{format(parseISO(t.date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            {t.type === 'income' ? 
                              <span className="text-green-600 dark:text-green-400 font-medium flex items-center"><ArrowUpCircle className="mr-1 h-4 w-4"/>Ingreso</span> : 
                              <span className="text-red-600 dark:text-red-400 font-medium flex items-center"><ArrowDownCircle className="mr-1 h-4 w-4"/>Gasto</span>
                            }
                          </TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <AlertCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>No se encontraron transacciones para el período seleccionado.</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">Mostrando {transactions.length} transacciones.</p>
            </CardFooter>
          </Card>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default CashFlow;