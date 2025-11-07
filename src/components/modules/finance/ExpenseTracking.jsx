import React, { useState, useEffect, useCallback } from 'react';
    import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { DatePickerWithRange } from '@/components/ui/datepicker';
    import SearchableSelect from '@/components/ui/SearchableSelect';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
    import { motion } from 'framer-motion';
    import { ShoppingCart, Receipt, PlusCircle, Edit3, Trash2, Download, Loader2 } from 'lucide-react';
    import { useToast } from "@/components/ui/use-toast";
    import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
    import { apiClient } from '@/lib/apiClient';
    import { triggerDownload } from '@/utils/safeDownload';
    import { useAuth } from '@/contexts/AuthContext';
    import { logAuditEvent } from '@/lib/auditUtils';

    const initialExpenseForm = {
      id: null,
      expense_date: new Date(),
      description: '',
      category: '',
      amount: '',
      provider: '',
      notes: ''
    };

    const ExpenseTracking = () => {
      const { toast } = useToast();
      const { user } = useAuth();
      const [expenses, setExpenses] = useState([]);
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [isLoading, setIsLoading] = useState(false);
      const [currentExpense, setCurrentExpense] = useState(initialExpenseForm);
      const [dateRange, setDateRange] = useState({ from: new Date(new Date().setDate(new Date().getDate() - 30)), to: new Date() });
      const [filterCategory, setFilterCategory] = useState('all');

      const loadExpenses = useCallback(async () => {
        if (!dateRange || !dateRange.from || !dateRange.to) return;
        setIsLoading(true);

        const fromDate = format(startOfDay(dateRange.from), "yyyy-MM-dd");
        const toDate = format(endOfDay(dateRange.to), "yyyy-MM-dd");

        try {
          const params = new URLSearchParams();
          params.set('from', fromDate);
          params.set('to', toDate);
          if (filterCategory !== 'all') params.set('category', filterCategory);
          const data = await apiClient.get(`/finance/expenses?${params.toString()}`);
          setExpenses(data || []);
        } catch (error) {
          toast({ title: 'Error', description: 'No se pudieron cargar los gastos.', variant: 'destructive' });
          console.error(error);
        } finally {
          setIsLoading(false);
        }
      }, [dateRange, filterCategory, toast]);

      useEffect(() => {
        loadExpenses();
      }, [loadExpenses]);

      const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCurrentExpense(prev => ({ ...prev, [name]: value }));
      };

      const handleDateChange = (date) => {
        if (isValid(date)) {
          setCurrentExpense(prev => ({ ...prev, expense_date: date }));
        } else {
           setCurrentExpense(prev => ({ ...prev, expense_date: new Date() }));
        }
      };
      
      const handleCategoryChange = (value) => {
         setCurrentExpense(prev => ({ ...prev, category: value }));
      };

      const handleSubmitExpense = async (e) => {
        e.preventDefault();
        if (!currentExpense.description || !currentExpense.category || !currentExpense.amount) {
          toast({ title: "Campos Requeridos", description: "Por favor, completa la descripción, categoría y monto.", variant: "destructive" });
          return;
        }
        const amount = parseFloat(currentExpense.amount);
        if (isNaN(amount) || amount <= 0) {
          toast({ title: "Monto Inválido", description: "El monto debe ser un número positivo.", variant: "destructive" });
          return;
        }

        setIsLoading(true);
  // cleaned unused vars
        const expenseData = {
          expense_date: format(currentExpense.expense_date, 'yyyy-MM-dd'),
          description: currentExpense.description,
          category: currentExpense.category,
          amount,
          provider: currentExpense.provider,
          notes: currentExpense.notes,
          user_id: user?.id,
        };

        try {
          let saved;
          if (currentExpense.id) {
            saved = await apiClient.put(`/finance/expenses/${currentExpense.id}`, expenseData);
            logAuditEvent('Finanzas:GastoActualizado', { expenseId: saved.id, description: saved.description });
            toast({ title: 'Gasto Actualizado', description: 'El gasto ha sido actualizado correctamente.' });
          } else {
            saved = await apiClient.post('/finance/expenses', expenseData);
            logAuditEvent('Finanzas:GastoCreado', { expenseId: saved.id, description: saved.description });
            toast({ title: 'Gasto Registrado', description: 'El nuevo gasto ha sido registrado.' });
          }
          await loadExpenses();
          setIsFormOpen(false);
          setCurrentExpense(initialExpenseForm);
        } catch (error) {
          toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      };

      const handleEditExpense = (expense) => {
        setCurrentExpense({
          ...expense,
          description: expense.description || expense.concept || '',
          category: expense.category || '',
          provider: expense.provider || '',
            // some legacy rows may store notes null
          notes: expense.notes || '',
          amount: (expense.amount != null && expense.amount !== '') ? expense.amount.toString() : '',
          expense_date: parseISO(expense.expense_date)
        });
        setIsFormOpen(true);
      };

      const handleDeleteExpense = async (expenseId, description) => {
        try {
          await apiClient.delete(`/finance/expenses/${expenseId}`);
          logAuditEvent('Finanzas:GastoEliminado', { expenseId, description });
          toast({ title: 'Gasto Eliminado', description: 'El gasto ha sido eliminado.', variant: 'destructive' });
          await loadExpenses();
        } catch (error) {
          toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
        }
      };
      
  const handleDownloadReport = () => {
        if (!expenses || expenses.length === 0) {
          toast({
            title: "Sin datos para exportar",
            description: "No hay gastos en el reporte para descargar.",
            variant: "destructive"
          });
          return;
        }

        const headers = ["Fecha", "Descripción", "Categoría", "Proveedor", "Monto (MXN)", "Notas"];
        const rows = expenses.map(exp => {
          const fecha = isValid(parseISO(exp.expense_date)) ? format(parseISO(exp.expense_date), 'dd/MM/yyyy') : exp.expense_date;
          const rawDesc = exp.description || exp.concept || '';
          const amt = parseFloat(exp.amount) || 0;
          return [
            fecha,
            `"${rawDesc.replace(/"/g, '""')}"`,
            `"${(exp.category||'').replace(/"/g, '""')}"`,
            `"${(exp.provider || '').replace(/"/g, '""')}"`,
            amt.toFixed(2),
            `"${(exp.notes || '').replace(/"/g, '""')}"`
          ].join(',');
        });

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(',') + "\r\n";
        csvContent += rows.join("\r\n");
        csvContent += `\r\n\r\nTotal,,,,${totalFilteredAmount.toFixed(2)}`;

  const encodedUri = encodeURI(csvContent);
  triggerDownload(encodedUri, 'reporte_gastos.csv');

        toast({
          title: "Descarga Iniciada",
          description: "El reporte de gastos se está descargando.",
        });
      };

  const totalFilteredAmount = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <Card className="shadow-xl glass-card overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-900/70 dark:via-orange-900/70 dark:to-amber-900/70 p-6">
              <div className="flex items-center">
                <ShoppingCart className="h-10 w-10 mr-4 text-red-600 dark:text-red-400" />
                <div>
                  <CardTitle className="text-3xl font-bold text-red-700 dark:text-red-300">
                    Control de Gastos
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    Registra, categoriza y analiza todos los gastos de tu laboratorio.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-slate-100 dark:bg-slate-800/30 rounded-lg">
                <div className="flex flex-wrap items-center gap-4">
                  <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
                  <SearchableSelect
                    options={[
                      {value:'all',label:'Todas'},
                      {value:'insumos',label:'Insumos de Laboratorio'},
                      {value:'operativos',label:'Gastos Operativos'},
                      {value:'administrativos',label:'Gastos Administrativos'},
                      {value:'marketing',label:'Marketing y Publicidad'},
                      {value:'mantenimiento',label:'Mantenimiento y Reparaciones'},
                      {value:'otro',label:'Otro'}
                    ]}
                    value={filterCategory}
                    onValueChange={setFilterCategory}
                    placeholder="Categoría"
                    searchPlaceholder="Buscar categoría..."
                    notFoundMessage="Sin categorías"
                  />
                </div>
                <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
                  setIsFormOpen(isOpen);
                  if (!isOpen) setCurrentExpense(initialExpenseForm);
                }}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white w-full md:w-auto">
                      <PlusCircle className="mr-2 h-4 w-4" /> Registrar Gasto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg bg-slate-50 dark:bg-slate-900">
                    <DialogHeader>
                      <DialogTitle className="text-red-700 dark:text-red-400 text-xl">{currentExpense.id ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitExpense} className="space-y-4 py-4">
                      <div>
                        <label htmlFor="fecha-gasto" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
                        <Input type="date" id="fecha-gasto" name="expense_date" 
                               value={currentExpense.expense_date instanceof Date && isValid(currentExpense.expense_date) ? format(currentExpense.expense_date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')} 
                               onChange={(e) => handleDateChange(parseISO(e.target.value))} 
                               className="bg-white dark:bg-slate-800" />
                      </div>
                      <div>
                        <label htmlFor="descripcion-gasto" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
                        <Input id="descripcion-gasto" name="description" value={currentExpense.description} onChange={handleInputChange} placeholder="Ej: Compra de reactivos" className="bg-white dark:bg-slate-800" required />
                      </div>
                      <div>
                        <label htmlFor="categoria-gasto" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                         <SearchableSelect
                           options={[
                             {value:'insumos',label:'Insumos de Laboratorio'},
                             {value:'operativos',label:'Gastos Operativos (renta, luz)'},
                             {value:'administrativos',label:'Gastos Administrativos (papelería)'},
                             {value:'marketing',label:'Marketing y Publicidad'},
                             {value:'mantenimiento',label:'Mantenimiento y Reparaciones'},
                             {value:'otro',label:'Otro'}
                           ]}
                           value={currentExpense.category}
                           onValueChange={handleCategoryChange}
                           placeholder="Seleccionar categoría"
                           searchPlaceholder="Buscar categoría..."
                           notFoundMessage="Sin categorías"
                         />
                      </div>
                       <div>
                        <label htmlFor="monto-gasto" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto (MXN)</label>
                        <Input type="number" step="0.01" id="monto-gasto" name="amount" value={currentExpense.amount} onChange={handleInputChange} placeholder="0.00" className="bg-white dark:bg-slate-800" required />
                      </div>
                      <div>
                        <label htmlFor="proveedor-gasto" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proveedor (Opcional)</label>
                        <Input id="proveedor-gasto" name="provider" value={currentExpense.provider} onChange={handleInputChange} placeholder="Nombre del proveedor" className="bg-white dark:bg-slate-800" />
                      </div>
                       <div>
                        <label htmlFor="notas-gasto" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas (Opcional)</label>
                        <Input id="notas-gasto" name="notes" value={currentExpense.notes} onChange={handleInputChange} placeholder="Información adicional" className="bg-white dark:bg-slate-800" />
                      </div>
                      <DialogFooter className="pt-4">
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
                        <Button type="submit" className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white" disabled={isLoading}>
                          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (currentExpense.id ? 'Guardar Cambios' : 'Registrar Gasto')}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle className="text-xl text-slate-700 dark:text-slate-200">Listado de Gastos</CardTitle>
                  <div className="text-right">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total en Periodo/Categoría:</p>
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400">{totalFilteredAmount.toFixed(2)} MXN</p>
                  </div>
                </CardHeader>
                <CardContent className="min-h-[200px]">
                  {isLoading ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>
                  ) : expenses.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead className="text-right">Monto (MXN)</TableHead>
                            <TableHead className="text-center">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenses.map(expense => (
                            <TableRow key={expense.id}>
                              <TableCell>{isValid(parseISO(expense.expense_date)) ? format(parseISO(expense.expense_date), 'dd/MM/yyyy') : 'Fecha inválida'}</TableCell>
                              <TableCell>{expense.description || expense.concept || ''}</TableCell>
                              <TableCell className="capitalize">{expense.category}</TableCell>
                              <TableCell>{expense.provider || '-'}</TableCell>
                              <TableCell className="text-right">{(() => { const n = parseFloat(expense.amount); return Number.isFinite(n) ? n.toFixed(2) : '0.00'; })()}</TableCell>
                              <TableCell className="text-center space-x-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEditExpense(expense)} className="text-blue-500 hover:text-blue-700"><Edit3 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(expense.id, expense.description)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <Receipt className="mx-auto h-12 w-12 mb-2 opacity-50" />
                      <p>No hay gastos registrados para el periodo o categoría seleccionada.</p>
                      <p className="text-sm mt-1">Intenta ajustar los filtros o registra un nuevo gasto.</p>
                    </div>
                  )}
                </CardContent>
                 <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
                    <p className="text-sm text-muted-foreground">Mostrando {expenses.length} gastos.</p>
                    <Button onClick={handleDownloadReport} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10 w-full sm:w-auto" disabled={expenses.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> Descargar Reporte
                    </Button>
                </CardFooter>
              </Card>
            </CardContent>
          </Card>
        </motion.div>
      );
    };

    export default ExpenseTracking;