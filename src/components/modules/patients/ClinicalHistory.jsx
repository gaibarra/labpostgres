import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { useParams, Link } from 'react-router-dom';
    import { apiClient } from '@/lib/apiClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
    import { Loader2, User, ChevronLeft, AlertCircle, FilterX } from 'lucide-react';
    import { format, parseISO, isValid } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { useEvaluationUtils } from '@/components/modules/orders/report_utils/evaluationUtils.js';
    import { useAppData } from '@/contexts/AppDataContext';

    const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-2 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg">
            <p className="label font-semibold text-slate-800 dark:text-slate-200">{`Fecha: ${label}`}</p>
            <p className="intro text-blue-600 dark:text-blue-400">{`Valor: ${payload[0].value}`}</p>
          </div>
        );
      }
      return null;
    };

    const ClinicalHistory = () => {
      const { patientId } = useParams();
      const { toast } = useToast();
      const { studies: allStudiesData, isLoading: isAppDataLoading } = useAppData();
      const { getReferenceRangeText } = useEvaluationUtils();

      const [patient, setPatient] = useState(null);
      const [historicalResults, setHistoricalResults] = useState([]);
      const [allParametersForChart, setAllParametersForChart] = useState([]);
      const [selectedParameterForChart, setSelectedParameterForChart] = useState('');
      const [chartData, setChartData] = useState([]);
      const [isComponentLoading, setIsComponentLoading] = useState(true);

      const [selectedStudyFilter, setSelectedStudyFilter] = useState('');
      const [selectedParameterFilter, setSelectedParameterFilter] = useState('');

      const studiesMap = useMemo(() => {
        const map = new Map();
        (allStudiesData || []).forEach(study => {
          const parametersMap = new Map();
          if (Array.isArray(study.parameters)) {
            study.parameters.forEach(param => {
              parametersMap.set(param.id, param);
            });
          }
          map.set(study.id, { ...study, parametersMap });
        });
        return map;
      }, [allStudiesData]);

      const processOrderResults = useCallback((order, patientData) => {
        const processed = [];
        if (!order.results || typeof order.results !== 'object') return processed;

        Object.entries(order.results).forEach(([studyId, studyResultsData]) => {
            const studyInfo = studiesMap.get(studyId);
            if (!studyInfo) {
              return;
            }

            let studyResultsArray = [];
            if (Array.isArray(studyResultsData)) {
                studyResultsArray = studyResultsData;
            } else if (typeof studyResultsData === 'object' && studyResultsData !== null) {
                studyResultsArray = Object.values(studyResultsData);
            }

            studyResultsArray.forEach(paramResult => {
                if (typeof paramResult !== 'object' || paramResult === null) return;
                
                const paramId = paramResult.parametroId;
                if (!paramId) return;

                // First, try to look up by ID (good practice)
                let paramInfo = studyInfo.parametersMap.get(paramId); 
                
                // If not found, fall back to looking up by name (for legacy data)
                if (!paramInfo) {
                  paramInfo = Array.from(studyInfo.parametersMap.values()).find(p => p.name === paramId);
                }

                if (paramInfo) {
                    processed.push({
                        date: order.order_date,
                        folio: order.folio,
                        studyName: studyInfo.name,
                        parameterName: paramInfo.name,
                        result: paramResult.valor,
                        unit: paramInfo.unit || studyInfo.general_units || 'N/A',
                        refRange: getReferenceRangeText(paramInfo, patientData)
                    });
                }
            });
        });
        return processed;
      }, [studiesMap, getReferenceRangeText]);

      const fetchPatientHistory = useCallback(async () => {
        if (!patientId || !studiesMap || studiesMap.size === 0) {
          setIsComponentLoading(false);
          return;
        }
        setIsComponentLoading(true);
        try {
          const patientData = await apiClient.get(`/patients/${patientId}`);
          if (!patientData) throw new Error('No se pudo cargar la información del paciente.');
          setPatient(patientData);

          // Fetch all orders and then filter in memory to keep endpoint simple for now
          const allOrders = await apiClient.get('/work-orders');
          const ordersData = (allOrders||[])
            .filter(o => o.patient_id === patientId && ['Concluida','Reportada'].includes(o.status))
            .sort((a,b)=> new Date(a.order_date)-new Date(b.order_date));
          
          const allResults = ordersData.flatMap(order => processOrderResults(order, patientData));
          const chartableParams = new Set(
            allResults
              .filter(r => !isNaN(parseFloat(r.result)))
              .map(r => r.parameterName)
          );

          setHistoricalResults(allResults.sort((a, b) => new Date(b.date) - new Date(a.date)));
          setAllParametersForChart(Array.from(chartableParams));
        } catch (error) {
          console.error("Error fetching patient history:", error);
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
          setIsComponentLoading(false);
        }
      }, [patientId, toast, studiesMap, processOrderResults]);

      useEffect(() => {
        if (!isAppDataLoading && studiesMap.size > 0) {
            fetchPatientHistory();
        }
      }, [isAppDataLoading, studiesMap, fetchPatientHistory]);
      
      useEffect(() => {
        if (selectedParameterForChart && historicalResults.length > 0) {
          const data = historicalResults
            .filter(r => r.parameterName === selectedParameterForChart && !isNaN(parseFloat(r.result)))
            .map(r => ({
              date: new Date(r.date),
              value: parseFloat(r.result),
            }))
            .sort((a,b) => a.date - b.date)
            .map(r => ({
              date: format(r.date, 'dd/MM/yy'),
              value: r.value,
            }));
          setChartData(data);
        } else {
          setChartData([]);
        }
      }, [selectedParameterForChart, historicalResults]);

      const filteredResults = useMemo(() => {
        return historicalResults.filter(result => {
          const studyMatch = !selectedStudyFilter || result.studyName === selectedStudyFilter;
          const parameterMatch = !selectedParameterFilter || result.parameterName === selectedParameterFilter;
          return studyMatch && parameterMatch;
        });
      }, [historicalResults, selectedStudyFilter, selectedParameterFilter]);

      const availableStudies = useMemo(() => [...new Set(historicalResults.map(r => r.studyName))], [historicalResults]);
      const availableParameters = useMemo(() => {
        if (!selectedStudyFilter) return [];
        return [...new Set(historicalResults.filter(r => r.studyName === selectedStudyFilter).map(r => r.parameterName))];
      }, [historicalResults, selectedStudyFilter]);

      const handleStudyFilterChange = (value) => {
        setSelectedStudyFilter(value);
        setSelectedParameterFilter('');
      };

      const clearFilters = () => {
        setSelectedStudyFilter('');
        setSelectedParameterFilter('');
      };

      if (isComponentLoading || isAppDataLoading) {
        return (
          <div className="flex justify-center items-center h-[calc(100vh-100px)]">
            <Loader2 className="h-12 w-12 animate-spin text-sky-600" />
          </div>
        );
      }

      if (!patient) {
         return (
            <div className="flex flex-col justify-center items-center h-[calc(100vh-100px)] text-slate-600 dark:text-slate-400">
                <AlertCircle className="h-12 w-12 mb-4 text-red-500"/>
                <h2 className="text-xl font-semibold">Paciente no encontrado</h2>
                <p className="mt-2">No se pudo encontrar información para este paciente.</p>
                <Button asChild variant="outline" className="mt-6">
                    <Link to="/patients"><ChevronLeft className="mr-2 h-4 w-4" />Volver a Pacientes</Link>
                </Button>
            </div>
         );
      }

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 p-4 md:p-6"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Historial Clínico del Paciente</h1>
             <Button asChild variant="outline">
                <Link to="/patients"><ChevronLeft className="mr-2 h-4 w-4" />Volver a Pacientes</Link>
            </Button>
          </div>
          
          <Card className="shadow-lg glass-card">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl text-sky-700 dark:text-sky-400">
                <User className="mr-3 h-6 w-6"/>
                {patient.full_name}
              </CardTitle>
              <CardDescription>
                {patient.email} | {patient.phone_number}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="font-semibold">Sexo:</span> {patient.sex}</div>
                <div><span className="font-semibold">Fecha Nacimiento:</span> {patient.date_of_birth && isValid(parseISO(patient.date_of_birth)) ? format(parseISO(patient.date_of_birth), 'dd MMMM yyyy', { locale: es }) : 'N/A'}</div>
                <div><span className="font-semibold">Dirección:</span> {patient.address}</div>
                <div><span className="font-semibold">Antecedentes:</span> {patient.clinical_history}</div>
            </CardContent>
          </Card>

          <Card className="shadow-lg glass-card">
            <CardHeader>
              <CardTitle className="text-xl text-slate-800 dark:text-slate-200">Evolución de Parámetros</CardTitle>
              <CardDescription>Selecciona un parámetro para ver su evolución en el tiempo.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 w-full md:w-1/3">
                 <Select onValueChange={setSelectedParameterForChart} value={selectedParameterForChart}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar un parámetro para graficar..." />
                    </SelectTrigger>
                    <SelectContent>
                        {allParametersForChart.map(param => (
                            <SelectItem key={param} value={param}>{param}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
              <div className="h-80 w-full">
                {selectedParameterForChart && chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="value" name={selectedParameterForChart} stroke="#0284c7" strokeWidth={2} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex justify-center items-center h-full text-slate-500 dark:text-slate-400">
                    {selectedParameterForChart ? 'No hay suficientes datos para graficar este parámetro.' : 'Selecciona un parámetro para visualizar la gráfica.'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg glass-card">
            <CardHeader>
              <CardTitle className="text-xl text-slate-800 dark:text-slate-200">Resultados Históricos</CardTitle>
              <CardDescription>Filtra los resultados por estudio y parámetro.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <Select onValueChange={handleStudyFilterChange} value={selectedStudyFilter}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Filtrar por estudio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStudies.map(study => <SelectItem key={study} value={study}>{study}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select onValueChange={setSelectedParameterFilter} value={selectedParameterFilter} disabled={!selectedStudyFilter}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Filtrar por parámetro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableParameters.map(param => <SelectItem key={param} value={param}>{param}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" onClick={clearFilters} className="flex items-center gap-2">
                  <FilterX className="h-4 w-4" />
                  Limpiar Filtros
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Folio</TableHead>
                            <TableHead>Estudio</TableHead>
                            <TableHead>Parámetro</TableHead>
                            <TableHead>Resultado</TableHead>
                            <TableHead>Unidades</TableHead>
                            <TableHead>Referencia</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredResults.length > 0 ? (
                            filteredResults.map((result, index) => (
                                <TableRow key={index}>
                                    <TableCell>{isValid(parseISO(result.date)) ? format(parseISO(result.date), 'dd/MM/yyyy') : 'Fecha inválida'}</TableCell>
                                    <TableCell>{result.folio}</TableCell>
                                    <TableCell>{result.studyName}</TableCell>
                                    <TableCell>{result.parameterName}</TableCell>
                                    <TableCell className="font-semibold">{result.result}</TableCell>
                                    <TableCell>{result.unit}</TableCell>
                                    <TableCell>{result.refRange}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={7} className="text-center h-24">
                                  {historicalResults.length === 0 ? "No hay resultados históricos para este paciente." : "No se encontraron resultados con los filtros aplicados."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    };

    export default ClinicalHistory;