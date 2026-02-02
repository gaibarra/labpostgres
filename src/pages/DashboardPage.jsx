import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, Users, FlaskConical, Package, Stethoscope, FileText, BarChart2, ListOrdered, ArrowRight, UserCircle, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLazyRecharts } from '@/hooks/useLazyRecharts';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { QuickActions, StatusDonutChart, ValueKPIs } from '@/components/dashboard';

// Helper para obtener nombre del paciente
function getPatientDisplayName(order) {
  if (!order) return '—';
  const p = order.patient || {};
  const candidates = [
    p.full_name,
    [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '),
    order.patient_full_name,
    order.patient_fullname,
    order.patientFirstLast,
    order.patient_name,
    order.patient_first_name && order.patient_last_name ? `${order.patient_first_name} ${order.patient_last_name}` : '',
    order.patient_first_name,
    order.patient_last_name
  ].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  if (candidates.length === 0) return '—';
  const unique = [...new Set(candidates)];
  return unique[0] || '—';
}

// StatCard component
const StatCard = ({ id, title, value, icon, description, to, accentBg = 'bg-sky-500', iconColor = 'text-sky-600' }) => {
  const IconEl = React.cloneElement(icon, {
    className: `${icon.props?.className || ''} ${iconColor}`.trim(),
  });
  return (
    <Link
      to={to || '#'}
      aria-label={`${title}. Ir a la sección`}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
    >
      <Card className="relative shadow-sm group-hover:shadow-lg transition-shadow duration-300 bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/60">
        <div className={`absolute inset-x-0 top-0 h-1 ${accentBg}`} />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-100">
            {title}
          </CardTitle>
          {IconEl}
        </CardHeader>
        <CardContent>
          <div data-testid={`stat-${id}`} className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();

  // Usar el nuevo hook SWR para datos del dashboard
  const {
    stats,
    statusSummary,
    recentOrders,
    counts,
    isLoading,
    isLoadingStats,
    error,
    mutate
  } = useDashboardStats(!!user);

  const { recharts, isLoading: isChartLibLoading, error: chartLibError } = useLazyRecharts();

  // Generar datos para el gráfico de barras de últimos 7 días
  const ordersLast7Days = useMemo(() => {
    const data = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      return {
        date,
        name: format(date, 'eee', { locale: es }),
        orders: 0
      };
    }).reverse();

    // Contar órdenes por día del statusBreakdown o recentOrders
    recentOrders.forEach(order => {
      if (!order.created_at) return;
      const orderDateStr = format(new Date(order.created_at), 'yyyy-MM-dd');
      const dayData = data.find(d => format(d.date, 'yyyy-MM-dd') === orderDateStr);
      if (dayData) {
        dayData.orders += 1;
      }
    });

    return data;
  }, [recentOrders]);

  const renderOrdersChart = () => {
    if (isChartLibLoading) {
      return (
        <div className="flex h-64 w-full items-center justify-center text-muted-foreground">
          Cargando gráficas...
        </div>
      );
    }
    if (chartLibError || !recharts) {
      return (
        <div className="flex h-64 w-full items-center justify-center text-center text-sm text-red-500">
          No se pudo cargar la librería de gráficas.
        </div>
      );
    }
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } = recharts;
    return (
      <ResponsiveContainer width="100%" height={250}>
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
    );
  };

  if (isLoading && !counts.patients) {
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
        <p className="text-sm text-red-600 dark:text-red-400">{error.message || 'Error desconocido'}</p>
        <Button onClick={() => mutate()} variant="outline" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
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
    {
      id: 'patients',
      title: "Pacientes Registrados",
      value: counts.patients,
      icon: <Users className="h-5 w-5" />,
      description: "Total de pacientes en el sistema",
      to: '/patients',
      accentBg: 'bg-sky-500',
      iconColor: 'text-sky-600'
    },
    {
      id: 'orders-today',
      title: "Órdenes de Hoy",
      value: stats.ordersToday,
      icon: <FileText className="h-5 w-5" />,
      description: "Órdenes creadas en el día",
      to: '/orders',
      accentBg: 'bg-violet-500',
      iconColor: 'text-violet-600'
    },
    {
      id: 'studies',
      title: "Estudios Disponibles",
      value: counts.studies,
      icon: <FlaskConical className="h-5 w-5" />,
      description: "Catálogo total de estudios",
      to: '/studies',
      accentBg: 'bg-emerald-500',
      iconColor: 'text-emerald-600'
    },
    {
      id: 'packages',
      title: "Paquetes Disponibles",
      value: counts.packages,
      icon: <Package className="h-5 w-5" />,
      description: "Catálogo total de paquetes",
      to: '/packages',
      accentBg: 'bg-fuchsia-500',
      iconColor: 'text-fuchsia-600'
    },
    {
      id: 'referrers',
      title: "Médicos Referentes",
      value: counts.referrers,
      icon: <Stethoscope className="h-5 w-5" />,
      description: "Total de médicos y entidades",
      to: '/referrers',
      accentBg: 'bg-teal-500',
      iconColor: 'text-teal-600'
    }
  ];

  const userName = user?.profile?.first_name && user?.profile?.last_name
    ? `${user.profile.first_name} ${user.profile.last_name}`
    : user?.email;
  const userRole = user?.profile?.role;

  return (
    <motion.div initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 dark:text-gray-200">
            Dashboard Principal
          </h1>
          <div className="flex items-center space-x-2 text-muted-foreground mt-2">
            <UserCircle className="h-5 w-5" />
            <span>
              Bienvenido de nuevo, <strong className="text-gray-700 dark:text-gray-300">{userName}</strong>
              {userRole && ` (${userRole})`}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          className="self-start sm:self-auto"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
        </Button>
      </div>

      {/* Acciones rápidas */}
      <motion.div custom={0} variants={cardVariants}>
        <QuickActions userRole={userRole} />
      </motion.div>

      {/* StatCards */}
      <motion.div
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {cardData.map((card, i) => (
          <motion.div key={card.title} custom={i + 1} variants={cardVariants}>
            <StatCard {...card} />
          </motion.div>
        ))}
      </motion.div>

      {/* KPIs de Valor */}
      <motion.div custom={6} variants={cardVariants}>
        <ValueKPIs stats={stats} isLoading={isLoadingStats} />
      </motion.div>

      {/* Gráficos y tabla */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Gráfico de barras */}
        <motion.div custom={7} variants={cardVariants} className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart2 className="mr-2 h-5 w-5 text-sky-500" />
                Órdenes Últimos 7 Días
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderOrdersChart()}
            </CardContent>
          </Card>
        </motion.div>

        {/* Donut de estados */}
        <motion.div custom={8} variants={cardVariants} className="lg:col-span-1">
          <StatusDonutChart
            data={statusSummary.data}
            total={statusSummary.total}
            period={statusSummary.period}
            isLoading={isLoadingStats}
          />
        </motion.div>

        {/* Órdenes recientes */}
        <motion.div custom={9} variants={cardVariants} className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center">
                <ListOrdered className="mr-2 h-5 w-5 text-indigo-500" />
                Órdenes Recientes
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/orders">Ver todas <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-grow">
              <ScrollArea className="h-[220px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Sin órdenes recientes
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentOrders.map((order) => {
                        const patientFullName = getPatientDisplayName(order);
                        return (
                          <TableRow key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                            <TableCell className="font-mono text-xs">
                              <Link to={`/orders?highlight=${order.id}#order-${order.id}`} className="text-sky-600 hover:underline">
                                {order.folio}
                              </Link>
                            </TableCell>
                            <TableCell className="font-medium truncate max-w-[120px]">
                              <Link to={`/orders?highlight=${order.id}#order-${order.id}`} className="hover:underline">
                                {patientFullName}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${order.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                                  order.status === 'Procesando' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' :
                                    order.status === 'Concluida' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                      order.status === 'Reportada' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                        order.status === 'Entregada' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                          order.status === 'Cancelada' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
                                }`}>
                                {order.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
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