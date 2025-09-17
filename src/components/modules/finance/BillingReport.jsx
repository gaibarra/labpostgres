import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/datepicker';
import { motion } from 'framer-motion';
import { FileBarChart, Filter, Download, BarChartBig, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format, startOfDay, endOfDay } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import SearchableSelect from '@/components/ui/SearchableSelect';
import BillingReportContent from './billing_report/BillingReportContent';
import { generateBillingReportPDF } from './billing_report/pdfGenerator';

const BillingReport = () => {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState({ from: new Date(new Date().setDate(new Date().getDate() - 30)), to: new Date() });
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInstitutions, setIsFetchingInstitutions] = useState(true);

  const fetchInstitutions = useCallback(async () => {
    setIsFetchingInstitutions(true);
    try {
      const res = await apiClient.get('/referrers?limit=500&search=');
      const data = (res?.data||[]).filter(r=>r.entity_type==='Institución');
      setInstitutions(data.map(i => ({ value: i.id, label: i.name })));
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudieron cargar las instituciones.', variant: 'destructive' });
    }
    setIsFetchingInstitutions(false);
  }, [toast]);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  const handleGenerateReport = async () => {
    if (!dateRange?.from || !dateRange?.to || !selectedInstitutionId) {
      toast({
        title: "Faltan Datos",
        description: "Por favor, selecciona una institución y un rango de fechas.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setReportData(null);

    const startDate = format(startOfDay(dateRange.from), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    const endDate = format(endOfDay(dateRange.to), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

    let orders = [];
    try {
      const incomeData = await apiClient.get(`/finance/income-report?from=${encodeURIComponent(startDate)}&to=${encodeURIComponent(endDate)}&status=Reportada,Concluida`);
      orders = (incomeData||[]).filter(o=> String(o.referring_entity_id) === String(selectedInstitutionId));
    } catch(e){
      setIsLoading(false);
      toast({ title: 'Error al generar reporte', description: e.message, variant: 'destructive' });
      return;
    }
    setIsLoading(false);

    if (orders.length === 0) {
      setReportData({ orders: [], groupedData: {}, grandTotal: 0 });
      toast({ title: "No hay Datos", description: "No se encontraron órdenes para la institución en el rango de fechas seleccionado." });
      return;
    }

    const groupedByPatient = orders.reduce((acc, order) => {
      const patientName = order.patient?.full_name || 'Paciente Desconocido';
      if (!acc[patientName]) {
        acc[patientName] = { orders: [], subtotal: 0 };
      }
      acc[patientName].orders.push(order);
      const orderTotal = order.selected_items.reduce((sum, item) => sum + (item.precio || 0), 0);
      acc[patientName].subtotal += orderTotal;
      return acc;
    }, {});

    const grandTotal = Object.values(groupedByPatient).reduce((sum, patient) => sum + patient.subtotal, 0);

    setReportData({
      orders,
      groupedData: groupedByPatient,
      grandTotal,
      institutionName: institutions.find(i => i.value === selectedInstitutionId)?.label,
      dateRange,
    });

    toast({ title: "Reporte Generado", description: `Se encontraron ${orders.length} órdenes.` });
  };

  const handleDownloadPDF = () => {
    if (!reportData) {
      toast({ title: "Sin datos", description: "Genera un reporte antes de descargarlo.", variant: "destructive" });
      return;
    }
    generateBillingReportPDF(reportData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-900/70 dark:via-pink-900/70 dark:to-rose-900/70 p-6">
          <div className="flex items-center">
            <FileBarChart className="h-10 w-10 mr-4 text-purple-600 dark:text-purple-400" />
            <div>
              <CardTitle className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                Reporte de Facturación por Institución
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Genera un desglose de costos por paciente para facturar a instituciones.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl flex items-center text-slate-700 dark:text-slate-200">
                <Filter className="h-5 w-5 mr-2 text-sky-500" />
                Filtros del Reporte
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Institución</label>
                <SearchableSelect
                  options={institutions}
                  value={selectedInstitutionId}
                  onValueChange={setSelectedInstitutionId}
                  placeholder="Seleccione una institución"
                  searchPlaceholder="Buscar institución..."
                  disabled={isFetchingInstitutions}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rango de Fechas</label>
                <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleGenerateReport} disabled={isLoading || isFetchingInstitutions} className="w-full md:w-auto bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChartBig className="mr-2 h-4 w-4" />}
                {isLoading ? 'Generando...' : 'Generar Reporte'}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-slate-50 dark:bg-slate-800/60 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-slate-700 dark:text-slate-200">Visualización del Reporte</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {reportData ? `Total a facturar: ${reportData.grandTotal.toFixed(2)} MXN` : 'Aquí se mostrará el desglose del reporte.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-[10rem] border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-md p-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
                  <p className="font-semibold">Generando reporte...</p>
                </div>
              ) : reportData ? (
                reportData.orders.length > 0 ? (
                  <BillingReportContent data={reportData} />
                ) : (
                  <div className="text-center text-slate-500 dark:text-slate-400">
                    <AlertCircle className="mx-auto h-12 w-12 mb-2 text-orange-500" />
                    <p>No se encontraron datos para los filtros seleccionados.</p>
                  </div>
                )
              ) : (
                <div className="text-center text-slate-500 dark:text-slate-400">
                  <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                  <p>Los datos del reporte aparecerán aquí una vez generados.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleDownloadPDF} variant="outline" className="border-purple-500 text-purple-500 hover:bg-purple-500/10" disabled={!reportData || reportData.orders.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Descargar PDF
              </Button>
            </CardFooter>
          </Card>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default BillingReport;