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

    const StatCard = ({ title, value, icon, description }) => (
      <Card className="shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white dark:bg-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</div>
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

      // Evitar doble fetch en StrictMode; recargar cuando cambia el usuario
      const loadedForUserRef = useRef(null);
      useEffect(() => {
        const fetchDashboardData = async () => {
          setIsLoading(true);
          setError(null);
          try {
            const today = new Date();
            // Backend endpoints asumidos (crear si faltan):
            // /patients/count, /analysis/count, /packages/count, /referrers/count, /work-orders/count?since=YYYY-MM-DD, /work-orders/recent?limit=5, /work-orders/recent?window=30d
            // Si aún no existen, haremos fallback a lista completa y contaremos en cliente.

            const fetchCount = async (path, fallbackListPath) => {
              try {
                const data = await apiClient.get(path);
                if (typeof data?.count === 'number') return data.count;
              } catch { /* ignore */ }
              if (!fallbackListPath) return 0;
              try {
                const list = await apiClient.get(fallbackListPath);
                return Array.isArray(list) ? list.length : 0;
              } catch { return 0; }
            };

            const sinceISO = today.toISOString().split('T')[0];
            const last30 = subDays(today, 30).toISOString();

            const [patientsCount, studiesCount, packagesCount, referrersCount, ordersTodayCount, recentOrdersData, recentOrdersForList] = await Promise.all([
              fetchCount('/patients/count','/patients'),
              fetchCount('/analysis/count','/analysis'),
              fetchCount('/packages/count','/packages'),
              fetchCount('/referrers/count','/referrers'),
              fetchCount(`/work-orders/count?since=${sinceISO}`,'/work-orders'),
              (async ()=>{ try { return await apiClient.get(`/work-orders/recent?window=30d`); } catch { return []; } })(),
              (async ()=>{ try { return await apiClient.get('/work-orders/recent?limit=5'); } catch { return []; } })(),
            ]);

            setStats({ patients: patientsCount, studies: studiesCount, packages: packagesCount, referrers: referrersCount, ordersToday: ordersTodayCount });
            setWorkOrders(recentOrdersData || []);
            setRecentOrdersList(recentOrdersForList || []);

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
        { title: "Pacientes Registrados", value: stats.patients, icon: <Users className="h-5 w-5 text-muted-foreground" />, description: "Total de pacientes en el sistema" },
        { title: "Órdenes de Hoy", value: stats.ordersToday, icon: <FileText className="h-5 w-5 text-muted-foreground" />, description: "Órdenes creadas en el día" },
        { title: "Estudios Disponibles", value: stats.studies, icon: <FlaskConical className="h-5 w-5 text-muted-foreground" />, description: "Catálogo total de estudios" },
        { title: "Paquetes Disponibles", value: stats.packages, icon: <Package className="h-5 w-5 text-muted-foreground" />, description: "Catálogo total de paquetes" },
        { title: "Médicos Referentes", value: stats.referrers, icon: <Stethoscope className="h-5 w-5 text-muted-foreground" />, description: "Total de médicos y entidades" }
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div custom={5} variants={cardVariants} className="lg:col-span-2">
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
            <motion.div custom={6} variants={cardVariants}>
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
                                {recentOrdersList.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-mono text-xs">{order.folio}</TableCell>
                                        <TableCell className="font-medium truncate max-w-[120px]">{order.patient?.full_name || 'N/A'}</TableCell>
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
                                ))}
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