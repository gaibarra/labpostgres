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

    // Helper to normalize names (study/parameter):
    // - map unicode sub/superscript digits to ASCII
    // - unify dash variants
    // - strip diacritics, collapse punctuation, lowercase
    // - tokenize and sort tokens for tolerant matching
    const normalizeParamName = (s) => {
      if (!s) return '';
      try {
        const str = String(s)
          // Normalize common dash variants to '-'
          .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
          // Map micro sign and Greek mu to 'u'
          .replace(/[\u00B5\u03BC]/g, 'u')
          // Map subscript digits ₀-₉ to 0-9
          .replace(/[\u2080-\u2089]/g, (m) => String('0123456789'[m.charCodeAt(0) - 0x2080]))
          // Map superscript digits ⁰¹²³⁴⁵⁶⁷⁸⁹ to 0-9
          .replace(/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]/g, (m) => {
            const map = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
            return map[m] || m;
          })
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // strip accents
          .toLowerCase();
        const base = str.replace(/[^a-z0-9]+/gi, ' ').trim();
        if (!base) return '';
        return base.split(/\s+/).sort().join(' ');
      } catch (_) {
        return String(s).toLowerCase();
      }
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
        // Índice principal por id y, como fallback, por code/clave/nombre para compatibilidad con datos legacy en results
        const map = new Map();
        (allStudiesData || []).forEach(study => {
          const parametersMap = new Map();
          const parametersNameIndex = new Map();
          if (Array.isArray(study.parameters)) {
            study.parameters.forEach(param => {
              // Indexar SIEMPRE por String(id) para evitar desajustes number/uuid/strings
              parametersMap.set(String(param.id), param);
              // índice por nombre normalizado para tolerar variantes (espacios, signos, orden de tokens)
              const norm = normalizeParamName(param.name);
              if (norm && !parametersNameIndex.has(norm)) {
                parametersNameIndex.set(norm, param);
              }
            });
          }
          const enriched = { ...study, parametersMap, parametersNameIndex };
          map.set(String(study.id), enriched);
          // Fallbacks opcionales: code/clave/name si existen
          if (study.code) map.set(String(study.code), enriched);
          if (study.clave) map.set(String(study.clave), enriched);
          if (study.name) map.set(String(study.name), enriched);
        });
        return map;
      }, [allStudiesData]);

      // Índice por nombre de estudio normalizado para compatibilidad con variantes tipográficas
      const studiesNameIndex = useMemo(() => {
        const idx = new Map();
        (allStudiesData || []).forEach(study => {
          if (study?.name) {
            const norm = normalizeParamName(study.name);
            if (norm && !idx.has(norm)) idx.set(norm, { ...study, parametersMap: new Map((study.parameters||[]).map(p => [String(p.id), p])), parametersNameIndex: new Map((study.parameters||[]).map(p => [normalizeParamName(p.name), p])) });
          }
        });
        return idx;
      }, [allStudiesData]);

      const processOrderResults = useCallback((order, patientData) => {
        const processed = [];
        if (!order.results || typeof order.results !== 'object') return processed;

        Object.entries(order.results).forEach(([studyId, studyResultsData]) => {
            // Buscar estudio por múltiples posibles claves (id, code, clave, nombre)
            let studyInfo = studiesMap.get(String(studyId));
            if (!studyInfo) {
              // Búsqueda lineal como último recurso
              studyInfo = Array.from(new Set(Array.from(studiesMap.values()))).find(s => {
                const candidates = [s.id, s.code, s.clave, s.name];
                return candidates.some(v => v != null && String(v) === String(studyId));
              });
            }
            if (!studyInfo) {
              // Intentar por nombre normalizado si el studyId es un nombre con variantes
              const normKey = normalizeParamName(String(studyId));
              if (normKey && studiesNameIndex.has(normKey)) {
                studyInfo = studiesNameIndex.get(normKey);
              }
            }
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
    let paramInfo = studyInfo.parametersMap.get(String(paramId)); 
                
                // If not found, fall back to looking up by name (for legacy data)
                if (!paramInfo) {
                  paramInfo = Array.from(studyInfo.parametersMap.values()).find(p => p.name === paramId);
                }

                // Finally, try normalized-name index (tolerant to punctuation/word order)
                if (!paramInfo) {
                  const norm = normalizeParamName(paramId);
                  if (norm && studyInfo.parametersNameIndex?.has(norm)) {
                    paramInfo = studyInfo.parametersNameIndex.get(norm);
                  }
                }

                if (paramInfo) {
          // Parseo numérico robusto (soporta coma decimal)
          const raw = paramResult.valor;
          const parsedNum = (typeof raw === 'string') ? parseFloat(raw.replace(',', '.')) : (raw == null ? NaN : Number(raw));
          // Asegurar unidad para referencia y presentación
          const paramForRef = { ...paramInfo, unit: paramInfo.unit || studyInfo.general_units };
                    processed.push({
                        date: order.order_date,
                        folio: order.folio,
                        studyName: studyInfo.name,
                        parameterName: paramInfo.name,
            result: isNaN(parsedNum) ? raw : String(parsedNum),
                        unit: paramForRef.unit || 'N/A',
                        refRange: getReferenceRangeText(paramForRef, patientData)
                    });
                }
            });
        });
        return processed;
  }, [studiesMap, studiesNameIndex, getReferenceRangeText]);

      const fetchPatientHistory = useCallback(async () => {
        if (!patientId || !studiesMap || studiesMap.size === 0) {
          setIsComponentLoading(false);
          return;
        }
        setIsComponentLoading(true);
        try {
          // Intento 1: usar backend agregado que ya normaliza todo
          try {
            const payload = await apiClient.get(`/patients/${patientId}/history`);
            if (!payload) throw new Error('Respuesta vacía');
            setPatient(payload.patient);
            // Enriquecer con texto de referencia usando el catálogo local de estudios/parámetros
            const normalized = (payload.results || []).map(r => {
              // Resolver estudio por múltiples claves conocidas o por nombre
              const studyKeyCandidates = [r.studyId, r.studyCode, r.studyClave, r.studyName]
                .filter(v => v !== undefined && v !== null)
                .map(v => String(v));
              let studyInfo = null;
              for (const key of studyKeyCandidates) {
                const found = studiesMap.get(key);
                if (found) { studyInfo = found; break; }
              }
              if (!studyInfo && r.studyName) {
                // fallback búsqueda lineal por nombre
                studyInfo = Array.from(new Set(Array.from(studiesMap.values()))).find(s => s.name === r.studyName);
              }
              if (!studyInfo && r.studyName) {
                // Intentar por nombre normalizado
                const norm = normalizeParamName(r.studyName);
                if (norm && studiesNameIndex.has(norm)) {
                  studyInfo = studiesNameIndex.get(norm);
                }
              }

              // Resolver parámetro por id o nombre
              let paramInfo = null;
              if (studyInfo) {
                if (r.parameterId) {
                  paramInfo = studyInfo.parametersMap.get(String(r.parameterId));
                }
                if (!paramInfo && r.parameterName) {
                  paramInfo = Array.from(studyInfo.parametersMap.values()).find(p => p.name === r.parameterName);
                }
                if (!paramInfo && r.parameterName) {
                  const norm = normalizeParamName(r.parameterName);
                  if (norm && studyInfo.parametersNameIndex?.has(norm)) {
                    paramInfo = studyInfo.parametersNameIndex.get(norm);
                  }
                }
              }

              // Asegurar unidad en el param para que el texto de referencia incluya unidades correctas
              const paramForRef = paramInfo ? { ...paramInfo, unit: paramInfo.unit || studyInfo?.general_units } : null;
              // Preferir SIEMPRE la referencia calculada cuando esté disponible; sólo caer al valor del backend si no podemos calcular o es N/A
              const refRangeText = paramForRef ? getReferenceRangeText(paramForRef, payload.patient) : null;
              const finalRefRange = (refRangeText && refRangeText !== 'N/A') ? refRangeText : (r.refRange || 'N/A');

              return {
                date: r.date,
                folio: r.folio,
                studyName: r.studyName,
                parameterName: r.parameterName,
                result: r.result,
                unit: r.unit || paramForRef?.unit || 'N/A',
                refRange: finalRefRange
              };
            });
            setHistoricalResults(normalized);
            setAllParametersForChart(payload.chartableParameters || []);
            return; // listo
          } catch(_e) {
            // Fallback al flujo anterior si el endpoint no existe o falla
          }

          const patientData = await apiClient.get(`/patients/${patientId}`);
          if (!patientData) throw new Error('No se pudo cargar la información del paciente.');
          setPatient(patientData);

          const allOrders = await apiClient.get('/work-orders');
          const ordersData = (allOrders||[])
            .filter(o => String(o.patient_id) === String(patientId) && ['Concluida','Reportada','Entregada'].includes(o.status))
            .sort((a,b)=> new Date(a.order_date)-new Date(b.order_date));
          const allResults = ordersData.flatMap(order => processOrderResults(order, patientData));
          const chartableParams = new Set(
            allResults
              .filter(r => {
                const n = (typeof r.result === 'string') ? parseFloat(r.result.replace(',', '.')) : Number(r.result);
                return !isNaN(n) && isFinite(n);
              })
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
  }, [patientId, toast, studiesMap, studiesNameIndex, processOrderResults, getReferenceRangeText]);

      useEffect(() => {
        if (!isAppDataLoading && studiesMap.size > 0) {
            fetchPatientHistory();
        }
      }, [isAppDataLoading, studiesMap, fetchPatientHistory]);
      
      useEffect(() => {
        if (selectedParameterForChart && historicalResults.length > 0) {
          const data = historicalResults
            .filter(r => {
              if (r.parameterName !== selectedParameterForChart) return false;
              const n = (typeof r.result === 'string') ? parseFloat(r.result.replace(',', '.')) : Number(r.result);
              return !isNaN(n) && isFinite(n);
            })
            .map(r => ({
              date: new Date(r.date),
              value: (typeof r.result === 'string') ? parseFloat(r.result.replace(',', '.')) : Number(r.result),
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