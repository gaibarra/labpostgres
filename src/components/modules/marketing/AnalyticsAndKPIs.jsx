import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { motion } from 'framer-motion';
import { BarChart3, Users, TrendingUp, MousePointerClick, Target as TargetIcon, CalendarDays, DollarSign, Percent, Eye, Filter, Clock, Mail, Send, Search as SearchIcon, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/components/ui/use-toast";
import { subDays, startOfYear, formatISO } from 'date-fns';
import { apiClient } from '@/lib/apiClient';

const kpiPeriods = ['Últimos 7 días', 'Últimos 30 días', 'Últimos 90 días', 'Este Año'];

const generateRandomData = (base, variance, isPercent = false, isCurrency = false) => {
  const value = base + (Math.random() * variance * 2) - variance;
  if (isPercent) return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
  if (isCurrency) return `${Math.max(0, value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return Math.max(0, Math.round(value)).toLocaleString('es-MX');
};

const initialKpiData = {
  websiteTraffic: { totalVisits: 0, uniqueVisitors: 0, bounceRate: '0%', avgSessionDuration: '0m 0s' },
  leadGeneration: { newLeads: 0, conversionRate: '0%', costPerLead: '$0.00' },
  campaignPerformance: { activeCampaigns: 0, totalSpend: '$0.00', impressions: 0, clicks: 0, ctr: '0%', cpc: '$0.00' },
  socialMedia: { totalFollowers: 0, engagementRate: '0%', postsPublished: 0, totalEngagement: 0 },
  emailMarketing: { campaignsSent: 0, openRate: '0%', clickThroughRate: '0%' },
  seoPerformance: { organicTraffic: 0, trackedKeywords: 0, publishedContent: 0 }
};

const AnalyticsAndKPIs = () => {
  const [kpiData, setKpiData] = useState(initialKpiData);
  const [selectedPeriod, setSelectedPeriod] = useState(kpiPeriods[1]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate;
    switch (selectedPeriod) {
      case 'Últimos 7 días':
        startDate = subDays(now, 7);
        break;
      case 'Últimos 30 días':
        startDate = subDays(now, 30);
        break;
      case 'Últimos 90 días':
        startDate = subDays(now, 90);
        break;
      case 'Este Año':
        startDate = startOfYear(now);
        break;
      default:
        startDate = subDays(now, 30);
    }
    return { from: formatISO(startDate), to: formatISO(now) };
  }, [selectedPeriod]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const { from, to } = getDateRange();
    try {
      const data = await apiClient.get(`/marketing/kpis?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      // Map server-provided basics + simulate extras similar to previous logic
      const totalEngagement = data.socialMedia.totalEngagement;
      setKpiData({
        leadGeneration: {
          newLeads: data.leadGeneration.newLeads,
          conversionRate: generateRandomData(5, 2, true),
          costPerLead: generateRandomData(15, 5, false, true)
        },
        campaignPerformance: {
          activeCampaigns: data.campaignPerformance.activeCampaigns,
          totalSpend: generateRandomData(1000, 300, false, true),
          impressions: generateRandomData(50000, 10000),
          clicks: generateRandomData(2500, 500),
          ctr: generateRandomData(5, 1.5, true),
          cpc: generateRandomData(0.5, 0.2, false, true)
        },
        socialMedia: {
          postsPublished: data.socialMedia.postsPublished,
          totalEngagement: totalEngagement.toLocaleString('es-MX'),
          totalFollowers: generateRandomData(5000, 1000),
          engagementRate: generateRandomData(2.5, 1, true),
        },
        emailMarketing: {
          campaignsSent: data.emailMarketing.campaignsSent,
          openRate: generateRandomData(25, 5, true),
          clickThroughRate: generateRandomData(3, 1, true)
        },
        seoPerformance: {
          trackedKeywords: data.seoPerformance.trackedKeywords,
          publishedContent: data.seoPerformance.publishedContent,
          organicTraffic: generateRandomData(600, 200),
        },
        websiteTraffic: {
          totalVisits: generateRandomData(1500, 500),
          uniqueVisitors: generateRandomData(1200, 400),
          bounceRate: generateRandomData(40, 10, true),
          avgSessionDuration: `${generateRandomData(2,1)}m ${generateRandomData(30,29)}s`
        },
      });
    } catch (error) {
      toast({ title: 'Error al cargar KPIs', description: error.message, variant: 'destructive' });
      setKpiData(initialKpiData);
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const KpiCard = ({ title, value, icon: Icon, description, trend }) => (
    <Card className="bg-white dark:bg-theme-davy-dark/50 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-theme-davy dark:text-theme-powder/90">{title}</CardTitle>
        <Icon className="h-5 w-5 text-theme-celestial dark:text-theme-celestial-light" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-theme-midnight dark:text-theme-powder">{value}</div>
        {description && <p className="text-xs text-muted-foreground dark:text-theme-powder/70">{description}</p>}
        {trend && <p className={`text-xs mt-1 ${trend.startsWith('+') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{trend}</p>}
      </CardContent>
    </Card>
  );

  const SectionCard = ({ title, children, icon: Icon }) => (
    <Card className="shadow-lg glass-card overflow-hidden">
      <CardHeader className="bg-theme-powder/30 dark:bg-theme-davy-dark/40">
        <CardTitle className="text-xl font-semibold text-theme-midnight dark:text-theme-powder flex items-center">
          {Icon && <Icon className="h-6 w-6 mr-3 text-theme-celestial dark:text-theme-celestial-light" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {children}
      </CardContent>
    </Card>
  );


  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
      <Card className="shadow-xl glass-card overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-theme-celestial/20 via-theme-powder/20 to-theme-periwinkle/20 dark:from-theme-celestial/30 dark:via-theme-powder/30 dark:to-theme-periwinkle/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="flex items-center mb-4 sm:mb-0">
              <BarChart3 className="h-10 w-10 mr-4 text-theme-celestial dark:text-theme-celestial-light" />
              <div>
                <CardTitle className="text-3xl font-bold text-theme-midnight dark:text-theme-powder">Analíticas y KPIs de Marketing</CardTitle>
                <CardDescription className="text-theme-davy dark:text-theme-powder/80">Visualiza el rendimiento de tus estrategias de marketing.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-theme-davy dark:text-theme-powder/80" />
              <SearchableSelect
                options={kpiPeriods.map(p=>({value:p,label:p}))}
                value={selectedPeriod}
                onValueChange={setSelectedPeriod}
                placeholder="Seleccionar Periodo"
                searchPlaceholder="Buscar periodo..."
                notFoundMessage="Sin periodos"
                disabled={isLoading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-[calc(100vh-300px)]">
              <Loader2 className="h-12 w-12 animate-spin text-theme-celestial" />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-6 pr-3">
                <SectionCard title="Tráfico Web (Simulado)" icon={TrendingUp}>
                  <KpiCard title="Visitas Totales" value={kpiData.websiteTraffic.totalVisits} icon={Eye} trend={`+${generateRandomData(5,2,true)} vs periodo ant.`}/>
                  <KpiCard title="Visitantes Únicos" value={kpiData.websiteTraffic.uniqueVisitors} icon={Users} trend={`+${generateRandomData(4,2,true)} vs periodo ant.`}/>
                  <KpiCard title="Tasa de Rebote" value={kpiData.websiteTraffic.bounceRate} icon={Percent} trend={`${Math.random() > 0.5 ? '+' : '-'}${generateRandomData(2,1,true)} vs periodo ant.`}/>
                  <KpiCard title="Duración Media Sesión" value={kpiData.websiteTraffic.avgSessionDuration} icon={Clock} trend={`+${generateRandomData(10,5)}s vs periodo ant.`}/>
                </SectionCard>

                <SectionCard title="Generación de Leads" icon={TargetIcon}>
                  <KpiCard title="Nuevos Leads (Pacientes)" value={kpiData.leadGeneration.newLeads} icon={Users} description="Pacientes nuevos registrados"/>
                  <KpiCard title="Tasa de Conversión (Sim.)" value={kpiData.leadGeneration.conversionRate} icon={Percent} description="Visitantes a Leads"/>
                  <KpiCard title="Costo por Lead (CPL) (Sim.)" value={kpiData.leadGeneration.costPerLead} icon={DollarSign} />
                </SectionCard>

                <SectionCard title="Rendimiento de Campañas" icon={MousePointerClick}>
                  <KpiCard title="Campañas Activas" value={kpiData.campaignPerformance.activeCampaigns} icon={CalendarDays} description="En el periodo seleccionado"/>
                  <KpiCard title="Gasto Total (Sim.)" value={kpiData.campaignPerformance.totalSpend} icon={DollarSign} />
                  <KpiCard title="Impresiones (Sim.)" value={kpiData.campaignPerformance.impressions} icon={Eye} />
                  <KpiCard title="Clics (Sim.)" value={kpiData.campaignPerformance.clicks} icon={MousePointerClick} />
                </SectionCard>
                
                <SectionCard title="Redes Sociales" icon={Users}>
                  <KpiCard title="Publicaciones Realizadas" value={kpiData.socialMedia.postsPublished} icon={Send} />
                  <KpiCard title="Engagement Total" value={kpiData.socialMedia.totalEngagement} icon={TrendingUp} description="Likes, Comentarios, etc."/>
                  <KpiCard title="Seguidores Totales (Sim.)" value={kpiData.socialMedia.totalFollowers} icon={Users} trend={`+${generateRandomData(50,20)} nuevos`}/>
                  <KpiCard title="Tasa de Engagement (Sim.)" value={kpiData.socialMedia.engagementRate} icon={Percent} trend={`+${generateRandomData(0.2,0.1,true)} vs periodo ant.`}/>
                </SectionCard>

                <SectionCard title="Email Marketing" icon={Mail}>
                  <KpiCard title="Campañas Enviadas" value={kpiData.emailMarketing.campaignsSent} icon={Send} />
                  <KpiCard title="Tasa de Apertura (Sim.)" value={kpiData.emailMarketing.openRate} icon={Eye} trend={`+${generateRandomData(1,0.5,true)} vs periodo ant.`}/>
                  <KpiCard title="Tasa de Clics (Email) (Sim.)" value={kpiData.emailMarketing.clickThroughRate} icon={MousePointerClick} trend={`+${generateRandomData(0.3,0.1,true)} vs periodo ant.`}/>
                </SectionCard>

                <SectionCard title="Rendimiento SEO" icon={SearchIcon}>
                  <KpiCard title="Keywords Rastreadas" value={kpiData.seoPerformance.trackedKeywords} icon={SearchIcon} description="Total en el sistema"/>
                  <KpiCard title="Contenido Publicado" value={kpiData.seoPerformance.publishedContent} icon={TrendingUp} description="Artículos en el periodo"/>
                  <KpiCard title="Tráfico Orgánico (Sim.)" value={kpiData.seoPerformance.organicTraffic} icon={TrendingUp} trend={`+${generateRandomData(15,5,true)} vs periodo ant.`}/>
                </SectionCard>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AnalyticsAndKPIs;