import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient, setToken, getToken } from '@/lib/apiClient';
import QRCode from 'qrcode.react';
import { formatInTimeZone } from '@/lib/dateUtils';
import { loadLabelPrefs, pageSizeCss } from '@/lib/labelPrintingConfig';
import { Loader2, ServerCrash } from 'lucide-react';

    const OrderLabelsPrint = () => {
        const { orderId } = useParams();
        const [order, setOrder] = useState(null);
        const [patient, setPatient] = useState(null);
        const [studies, setStudies] = useState([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);

                // Bootstrap de token desde hash (#at=TOKEN) o via postMessage
                                useEffect(() => {
                                                let fetchedMe = false;
                        // 1) Leer token del hash si viene
                        try {
                            const hash = typeof window !== 'undefined' ? window.location.hash : '';
                            const m = hash && hash.match(/[#&]at=([^&]+)/);
                            if (m && m[1]) {
                                const token = decodeURIComponent(m[1]);
                                                                if (token && !getToken()) {
                                                                    setToken(token);
                                                                }
                            }
                        } catch(_) { /* noop */ }
                                                // If token already present now, trigger /auth/me once
                                                try {
                                                    if (getToken()) {
                                                        fetchedMe = true;
                                                        apiClient.auth.me().catch(()=>{});
                                                    }
                                                } catch(_) { /* ignore */ }
                        // 2) Escuchar postMessage del opener con el token
                        try {
                            const handler = (e) => {
                                if (!e || !e.data) return;
                                if (e.origin !== window.location.origin) return; // misma origin
                                if (e.data.type === 'LABG40_AUTH_TOKEN' && e.data.token && !getToken()) {
                                                                        setToken(e.data.token);
                                                                        if (!fetchedMe) {
                                                                            fetchedMe = true;
                                                                            apiClient.auth.me().catch(()=>{});
                                                                        }
                                }
                            };
                            window.addEventListener('message', handler);
                            return () => window.removeEventListener('message', handler);
                        } catch(_) { /* ignore */ }
                }, []);

                useEffect(() => {
            const fetchOrderData = async () => {
                if (!orderId) {
                    setError("No se proporcionó ID de la orden.");
                    setLoading(false);
                    return;
                }

                try {
                    const orderData = await apiClient.get(`/work-orders/${orderId}`);
                    if (!orderData) throw new Error('Orden no encontrada.');
                    setOrder(orderData);

                    const patientData = await apiClient.get(`/patients/${orderData.patient_id}`);
                    setPatient(patientData);

                    const studiesResp = await apiClient.get('/analysis?limit=1000');
                    const allStudies = { data: studiesResp.data || [] };
                    const packagesResp = await apiClient.get('/packages/detailed?limit=5000');
                    const allPackages = { data: packagesResp.data || [] };
                    
                    const studiesMap = new Map((allStudies.data||[]).map(s => [s.id, s]));
                    const packagesMap = new Map((allPackages.data||[]).map(p => [p.id, p]));
                    const studiesToPrint = [];
                    const addedStudies = new Set();
                    
                    const stack = [...(orderData.selected_items || [])];
                    while(stack.length > 0) {
                        const item = stack.pop();
                        const id = item.id || item.item_id;
                        const type = item.type || item.item_type;

                        if (type === 'study') {
                            if (!addedStudies.has(id)) {
                                const study = studiesMap.get(id);
                                if (study && study.sample_container) {
                                    studiesToPrint.push(study);
                                }
                                addedStudies.add(id);
                            }
                        } else if (type === 'package') {
                            const pkg = packagesMap.get(id);
                            if (pkg && pkg.items) {
                                pkg.items.forEach(subItem => stack.push({ id: subItem.item_id, type: subItem.item_type}));
                            }
                        }
                    }
                    setStudies(studiesToPrint);

                } catch (err) {
                    console.error("Error fetching data for labels:", err);
                    setError(err.message || "Ocurrió un error desconocido.");
                } finally {
                    setLoading(false);
                }
            };

            fetchOrderData();
        }, [orderId]);

        if (loading) {
            return (
                <div className="flex items-center justify-center h-screen">
                    <Loader2 className="h-12 w-12 animate-spin text-sky-500" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-screen text-red-500 p-4">
                    <ServerCrash className="h-12 w-12 mb-4" />
                    <h1 className="text-xl font-bold mb-2">Error al Cargar Datos</h1>
                    <p>{error}</p>
                </div>
            );
        }

        if (!order || !patient || studies.length === 0) {
            return (
                <div className="p-4">No hay etiquetas para imprimir para esta orden. Asegúrese de que los estudios seleccionados tengan un contenedor de muestra especificado.</div>
            );
        }

        const prefs = loadLabelPrefs();
        const dynamicCss = pageSizeCss(prefs);
        return (
            <div className="p-2 font-sans bg-white">
                <style>{dynamicCss}</style>
                <div className="grid grid-cols-2 gap-2">
                    {studies.map((study, index) => {
                        const qrValue = `Folio: ${order.folio}\nPaciente: ${patient.full_name}\nEstudio: ${study.name}\nContenedor: ${study.sample_container}`;
                        return (
                            <div key={index} className="border border-black p-2 flex items-start space-x-2" style={{ pageBreakInside: 'avoid', width: '3.5in', height: '1.5in' }}>
                                <div className="flex-shrink-0">
                                    <QRCode value={qrValue} size={64} level="M" />
                                </div>
                                <div className="text-xs flex-grow overflow-hidden">
                                    <p className="font-bold truncate text-sm">{patient.full_name}</p>
                                    <p className="truncate">Folio: {order.folio}</p>
                                    <p className="truncate">Fecha: {formatInTimeZone(order.order_date, 'dd/MM/yy')}</p>
                                    <p className="font-semibold truncate">{study.name}</p>
                                    <p className="truncate">Cont.: {study.sample_container}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    export default OrderLabelsPrint;