import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { Loader2, Sparkles, AlertTriangle, Printer } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useOrderManagement } from './hooks/useOrderManagement.js';
import { Button } from '@/components/ui/button';
import { useReactToPrint } from 'react-to-print';
import AIReportContent from './AIReportContent';

const AIRecommendationsPrint = () => {
    const { orderId } = useParams();
    const { settings: labSettings } = useSettings();
    const { studies, packages, loadData: loadOrderManagementData } = useOrderManagement();

    const [order, setOrder] = useState(null);
    const [patient, setPatient] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const printRef = useRef();
    
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Recomendaciones-IA-${order?.folio || 'reporte'}`,
    });

    useEffect(() => {
        loadOrderManagementData();
    }, [loadOrderManagementData]);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!orderId || !labSettings || !studies || studies.length === 0) {
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const orderData = await apiClient.get(`/work-orders/${orderId}`);
                if (!orderData) throw new Error('Orden no encontrada.');

                setOrder(orderData);
                setPatient(orderData.patient_id);
                
                const aiRecommendations = orderData.ai_recommendations; // Assume backend stores if generated
                if (!aiRecommendations) {
                   throw new Error("Esta orden no tiene recomendaciones de IA generadas.");
                }

                setRecommendations(aiRecommendations);

            } catch (err) {
                console.error("Error en la página de impresión:", err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [orderId, labSettings, studies, packages]);

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-slate-50"><Loader2 className="h-16 w-16 animate-spin text-sky-500" /></div>;
    }

    if (error) {
        return <div className="flex items-center justify-center min-h-screen bg-red-50 text-red-700 p-8"><AlertTriangle className="h-8 w-8 mr-4" /><div><h1 className="font-bold text-lg">Error</h1><p>{error}</p></div></div>;
    }

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen p-4 sm:p-8">
             <div className="max-w-4xl mx-auto">
                <div className="p-4 bg-white rounded-t-lg no-print flex justify-between items-center border-b">
                    <h1 className="text-lg font-semibold">Imprimir Recomendaciones IA</h1>
                    <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
                </div>
                <div className="p-8 bg-white shadow-lg">
                    <AIReportContent
                        ref={printRef}
                        labInfo={labSettings.labInfo}
                        order={order}
                        patient={patient}
                        recommendations={recommendations}
                    />
                </div>
            </div>
            <style jsx global>{`
                @media print {
                    body {
                        background-color: #fff;
                    }
                    .no-print {
                        display: none;
                    }
                    .printable-area {
                        box-shadow: none;
                        margin: 0;
                        padding: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default AIRecommendationsPrint;