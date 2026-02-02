import useSWR from 'swr';
import apiClient from '@/lib/apiClient';

// Fetcher genérico para SWR
const fetcher = (url) => apiClient.get(url);

/**
 * Hook para obtener estadísticas del dashboard con cache SWR
 * @param {boolean} enabled - Si debe hacer fetch (ej: solo cuando hay usuario)
 * @returns {{ stats, statusSummary, recentOrders, isLoading, error, mutate }}
 */
export function useDashboardStats(enabled = true) {
    // Estadísticas principales (KPIs)
    const {
        data: stats,
        error: statsError,
        isLoading: statsLoading,
        mutate: mutateStats
    } = useSWR(
        enabled ? '/work-orders/stats' : null,
        fetcher,
        {
            revalidateOnFocus: true,
            refreshInterval: 60000, // Refrescar cada minuto
            dedupingInterval: 10000, // Deduplicar requests en 10s
            errorRetryCount: 2
        }
    );

    // Resumen de estados para donut chart
    const {
        data: statusSummary,
        error: statusError,
        isLoading: statusLoading
    } = useSWR(
        enabled ? '/work-orders/status-summary?days=30' : null,
        fetcher,
        {
            revalidateOnFocus: false,
            refreshInterval: 120000, // Refrescar cada 2 minutos
            dedupingInterval: 30000
        }
    );

    // Órdenes recientes
    const {
        data: recentOrders,
        error: recentError,
        isLoading: recentLoading,
        mutate: mutateRecent
    } = useSWR(
        enabled ? '/work-orders/recent?limit=5' : null,
        fetcher,
        {
            revalidateOnFocus: true,
            refreshInterval: 30000, // Refrescar cada 30s
            dedupingInterval: 5000
        }
    );

    // Conteos de entidades
    const { data: counts, isLoading: countsLoading } = useSWR(
        enabled ? '/dashboard/counts' : null,
        async () => {
            const [patients, studies, packages, referrers] = await Promise.all([
                apiClient.get('/patients/count').catch(() => ({ total: 0 })),
                apiClient.get('/analysis/count').catch(() => ({ total: 0 })),
                apiClient.get('/packages/count').catch(() => ({ total: 0 })),
                apiClient.get('/referrers/count').catch(() => ({ total: 0 }))
            ]);
            return {
                patients: patients?.total || 0,
                studies: studies?.total || 0,
                packages: packages?.total || 0,
                referrers: referrers?.total || 0
            };
        },
        {
            revalidateOnFocus: false,
            refreshInterval: 300000, // Refrescar cada 5 minutos
            dedupingInterval: 60000
        }
    );

    return {
        // KPIs de valor
        stats: stats || {
            ordersToday: 0,
            ordersWeek: 0,
            ordersMonth: 0,
            revenueToday: 0,
            revenueWeek: 0,
            avgDeliveryTimeHours: null,
            conversionRate: 0,
            topStudies: [],
            statusBreakdown: {}
        },
        // Datos para donut chart
        statusSummary: statusSummary || { data: [], total: 0, period: '30 días' },
        // Órdenes recientes
        recentOrders: Array.isArray(recentOrders) ? recentOrders : (recentOrders?.data || []),
        // Conteos de entidades
        counts: counts || { patients: 0, studies: 0, packages: 0, referrers: 0 },
        // Estados de carga
        isLoading: statsLoading || statusLoading || recentLoading || countsLoading,
        isLoadingStats: statsLoading,
        isLoadingStatus: statusLoading,
        isLoadingRecent: recentLoading,
        // Errores
        error: statsError || statusError || recentError,
        // Funciones para refrescar
        mutate: () => {
            mutateStats();
            mutateRecent();
        }
    };
}

export default useDashboardStats;
