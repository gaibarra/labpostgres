import React, { useState, useEffect, useMemo, useRef } from 'react';
import apiClient from '@/lib/apiClient';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, Users, FlaskConical, Package, Stethoscope, FileText, BarChart2, ListOrdered, ArrowRight, UserCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

// Helper fuera del componente para reutilizar y testear aisladamente si se desea.
function getPatientDisplayName(order) {
  if (!order) return '—';
  const p = order.patient || {};
  // Posibles fuentes (orden de prioridad)
  const candidates = [
    p.full_name,
    [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '),
    order.patient_full_name,
    order.patient_fullname,
    order.patientFirstLast,
    order.patient_name,
    // Campos planos que algunos endpoints podrían devolver
    order.patient_first_name && order.patient_last_name ? `${order.patient_first_name} ${order.patient_last_name}` : '',
    order.patient_first_name,
    order.patient_last_name
  ].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  if (candidates.length === 0) return '—';
  // Eliminar duplicados manteniendo orden
  const unique = [...new Set(candidates)];
  return unique[0] || '—';
}

const StatCard = ({ id, title, value, icon, description }) => (
  <Card className="shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white dark:bg-slate-800">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div data-testid={`stat-${id}`} className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    patients: 0,
    studies: 0,
    packages: 0,
    referrers: 0,
    ordersToday: 0,
  });
  const [workOrders, setWorkOrders] = useState([]);
  const [recentOrdersList, setRecentOrdersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrichedPatientMap, setEnrichedPatientMap] = useState({}); // id -> full_name

  // Evitar doble fetch en StrictMode; recargar cuando cambia el usuario
  const loadedForUserRef = useRef(null);
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const today = new Date();

        // Helper robusto: acepta respuestas en múltiples formatos
        const extractTotal = (resp) => {
          if (resp == null) return 0;
          // Formatos posibles:
          // { total: n }
          if (typeof resp.total === 'number') return resp.total;
          if (typeof resp.count === 'number') return resp.count; // por si algún endpoint usa 'count'
          // { page: { total: n } }
          if (resp.page && typeof resp.page.total === 'number') return resp.page.total;
          // { data: [...], page:{ ... } }
          if (Array.isArray(resp.data) && resp.page && typeof resp.page.total === 'number') return resp.page.total;
          // Array simple
          if (Array.isArray(resp)) return resp.length;
          return 0;
        };

        const fetchTotal = async (primaryPath, fallbackPath) => {
          try {
            const res = await apiClient.get(primaryPath);
            const total = extractTotal(res);
            if (total > 0) return total;
            // Si el endpoint count devolvió 0 podemos devolver 0 directamente (0 es válido) sin fallback
            if (total === 0) return 0;
          } catch (_) { /* ignorar y probar fallback */ }
          if (!fallbackPath) return 0;
          try {
            const resFallback = await apiClient.get(fallbackPath);
            return extractTotal(resFallback);
          } catch (_) { return 0; }
        };

        const sinceISO = today.toISOString().split('T')[0];

        const [patientsCount, studiesCount, packagesCount, referrersCount, ordersTodayCount, recentOrdersData, recentOrdersForList] = await Promise.all([
          fetchTotal('/patients/count','/patients'),
          fetchTotal('/analysis/count','/analysis'),
          fetchTotal('/packages/count','/packages'),
          fetchTotal('/referrers/count','/referrers'),
          fetchTotal(`/work-orders/count?since=${sinceISO}`,'/work-orders'),
          (async ()=>{ try { return await apiClient.get(`/work-orders/recent?window=30d`); } catch { return []; } })(),
          (async ()=>{ try { return await apiClient.get('/work-orders/recent?limit=5'); } catch { return []; } })(),
        ]);

        setStats({ patients: patientsCount, studies: studiesCount, packages: packagesCount, referrers: referrersCount, ordersToday: ordersTodayCount });
        setWorkOrders(Array.isArray(recentOrdersData) ? recentOrdersData : (recentOrdersData?.data || []));
        setRecentOrdersList(Array.isArray(recentOrdersForList) ? recentOrdersForList : (recentOrdersForList?.data || []));

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    // Si no hay usuario, no intentamos cargar y reseteamos guard
    if (!user) {
      loadedForUserRef.current = null;
      setIsLoading(false);
      return;
    }
    const userKey = user?.id || user?.email || 'anonymous';
    if (loadedForUserRef.current === userKey) return; // evitar doble llamada por StrictMode
    loadedForUserRef.current = userKey;
    fetchDashboardData();
  }, [user]);
  
  const ordersLast7Days = useMemo(() => {
    const data = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        return { 
            date, 
            name: format(date, 'eee', { locale: es }), 
            orders: 0 
        };
    }).reverse();

    workOrders.forEach(order => {
        const orderDateStr = format(new Date(order.created_at), 'yyyy-MM-dd');
        const dayData = data.find(d => format(d.date, 'yyyy-MM-dd') === orderDateStr);
        if (dayData) {
            dayData.orders += 1;
        }
    });

    return data;
  }, [workOrders]);

  // Enriquecer órdenes recientes con fetch de pacientes si solo tenemos patient_id sin nombre.
  useEffect(() => {
    const missingIds = recentOrdersList
      .filter(o => !!o.patient_id && !getPatientDisplayName(o).replace(/^[—-]+$/, '').trim())
      .map(o => o.patient_id)
      .filter(id => id && !enrichedPatientMap[id]);
    if (missingIds.length === 0) return;
    let aborted = false;
    (async () => {
      const updates = {};
      for (const id of missingIds.slice(0,5)) { // limitar lote para evitar presión
        try {
          const p = await apiClient.get(`/patients/${id}`);
          const name = p?.full_name || [p?.first_name, p?.middle_name, p?.last_name].filter(Boolean).join(' ');
          if (name && !aborted) updates[id] = name.trim();
        } catch (_) { /* ignorar */ }
      }
      if (!aborted && Object.keys(updates).length) {
        setEnrichedPatientMap(prev => ({ ...prev, ...updates }));
        // mapear recentOrdersList para inyectar
        setRecentOrdersList(prev => prev.map(o => {
          if (updates[o.patient_id]) {
            return { ...o, patient: { ...(o.patient||{}), full_name: updates[o.patient_id] } };
          }
          return o;
        }));
      }
    })();
    return () => { aborted = true; };
  }, [recentOrdersList, enrichedPatientMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <Loader2 className="h-10 w-10 animate-spin text-sky-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] bg-red-50 dark:bg-red-900/20 rounded-lg">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="mt-4 text-lg font-semibold text-red-700 dark:text-red-300">Error al Cargar el Dashboard</p>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5 },
    }),
  };
  
  const cardData = [
    { id: 'patients', title: "Pacientes Registrados", value: stats.patients, icon: <Users className="h-5 w-5 text-muted-foreground" />, description: "Total de pacientes en el sistema" },
    { id: 'orders-today', title: "Órdenes de Hoy", value: stats.ordersToday, icon: <FileText className="h-5 w-5 text-muted-foreground" />, description: "Órdenes creadas en el día" },
    { id: 'studies', title: "Estudios Disponibles", value: stats.studies, icon: <FlaskConical className="h-5 w-5 text-muted-foreground" />, description: "Catálogo total de estudios" },
    { id: 'packages', title: "Paquetes Disponibles", value: stats.packages, icon: <Package className="h-5 w-5 text-muted-foreground" />, description: "Catálogo total de paquetes" },
    { id: 'referrers', title: "Médicos Referentes", value: stats.referrers, icon: <Stethoscope className="h-5 w-5 text-muted-foreground" />, description: "Total de médicos y entidades" }
  ];

  const userName = user?.profile?.first_name && user?.profile?.last_name ? `${user.profile.first_name} ${user.profile.last_name}` : user?.email;
  const userRole = user?.profile?.role;

  return (
    <motion.div initial="hidden" animate="visible" className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 dark:text-gray-200">Dashboard Principal</h1>
        <div className="flex items-center space-x-2 text-muted-foreground mt-2">
          <UserCircle className="h-5 w-5" />
          <span>
            Bienvenido de nuevo, <strong className="text-gray-700 dark:text-gray-300">{userName}</strong>
            {userRole && ` (${userRole})`}
          </span>
        </div>
      </div>
      <motion.div
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cardData.map((card, i) => (
           <motion.div key={card.title} custom={i} variants={cardVariants}>
            <StatCard {...card} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Gráfico ahora ocupa 1 columna (antes 2) */}
        <motion.div custom={5} variants={cardVariants} className="order-2 lg:order-1 lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><BarChart2 className="mr-2 h-5 w-5 text-sky-500" /> Órdenes en los Últimos 7 Días</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={ordersLast7Days}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} fontSize={12} />
                            <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--background))',
                                    borderColor: 'hsl(var(--border))'
                                }}
                            />
                            <Bar dataKey="orders" name="Órdenes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </motion.div>
    {/* Órdenes Recientes ahora ocupa 2 columnas en desktop */}
    <motion.div custom={6} variants={cardVariants} className="order-1 lg:order-2 lg:col-span-2">
      <Card className="h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center"><ListOrdered className="mr-2 h-5 w-5 text-indigo-500" /> Órdenes Recientes</CardTitle>
                    <Button asChild variant="ghost" size="sm">
                        <Link to="/orders">Ver todas <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ScrollArea className="h-[250px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Folio</TableHead>
                                <TableHead>Paciente</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentOrdersList.map((order) => {
                                const patientFullName = getPatientDisplayName(order);
                                return (
                                <TableRow key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" aschild="true">
                                    <TableCell className="font-mono text-xs">
                                      <Link to={`/orders?highlight=${order.id}#order-${order.id}`} className="text-sky-600 hover:underline">
                                        {order.folio}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="font-medium truncate max-w-[160px]">
                                      <Link to={`/orders?highlight=${order.id}#order-${order.id}`} className="hover:underline">
                                        {patientFullName}
                                      </Link>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            order.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                                            order.status === 'Procesando' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' :
                                            order.status === 'Concluida' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                            order.status === 'Reportada' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                            order.status === 'Cancelada' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            );})}
                        </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
            </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default DashboardPage;