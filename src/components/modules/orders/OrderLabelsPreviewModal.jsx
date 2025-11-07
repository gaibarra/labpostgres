import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from 'lucide-react';
import { apiClient, getToken } from '@/lib/apiClient';
import { formatInTimeZone } from '@/lib/dateUtils';
import { LABEL_SIZE_PRESETS, loadLabelPrefs, saveLabelPrefs, getActiveSize } from '@/lib/labelPrintingConfig';
import { listPrinters, printHtmlTo } from '@/lib/qzClient';

const OrderLabelsPreviewModal = ({ isOpen, onOpenChange, order }) => {
    const [studies, setStudies] = useState([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [printers, setPrinters] = useState([]);
    const [prefs, setPrefs] = useState(() => loadLabelPrefs());
    const [discoveringPrinters, setDiscoveringPrinters] = useState(false);
    const activeSize = getActiveSize(prefs);

        // Build preview of labels (without QR canvas to avoid jsdom warnings in tests)
    useEffect(() => {
            if (!isOpen) return; // only when opened
            if (!order?.id) return;
            // If order already has selected_items we can attempt preview; otherwise skip.
            if (!Array.isArray(order.selected_items) || order.selected_items.length === 0) return;
            let cancelled = false;
            const run = async () => {
                setLoadingPreview(true);
                setPreviewError(null);
                try {
                    const studiesResp = await apiClient.get('/analysis?limit=1000');
                    const allStudies = studiesResp?.data || [];
                    const packagesResp = await apiClient.get('/packages/detailed?limit=5000');
                    const allPackages = packagesResp?.data || [];
                    const studiesMap = new Map(allStudies.map(s => [s.id, s]));
                    const packagesMap = new Map(allPackages.map(p => [p.id, p]));
                    const toPrint = [];
                    const added = new Set();
                    const stack = [...order.selected_items];
                    while (stack.length) {
                        const item = stack.pop();
                        const id = item.id || item.item_id;
                        const type = item.type || item.item_type;
                        if (type === 'study') {
                            if (!added.has(id)) {
                                const study = studiesMap.get(id);
                                if (study && study.sample_container) {
                                    toPrint.push(study);
                                }
                                added.add(id);
                            }
                        } else if (type === 'package') {
                            const pkg = packagesMap.get(id);
                            if (pkg?.items) {
                                pkg.items.forEach(sub => stack.push({ id: sub.item_id, type: sub.item_type }));
                            }
                        }
                    }
                    if (!cancelled) setStudies(toPrint);
                } catch (err) {
                    if (!cancelled) setPreviewError(err.message || 'Error al generar previsualización.');
                } finally {
                    if (!cancelled) setLoadingPreview(false);
                }
            };
            run();
            return () => { cancelled = true; };
        }, [isOpen, order]);

        // Printer discovery when modal opens
        useEffect(() => {
            if (!isOpen) return;
            let cancelled = false;
            const discover = async () => {
                setDiscoveringPrinters(true);
                try {
                    const list = await listPrinters();
                    if (!cancelled) setPrinters(list);
                } catch (_) {
                    if (!cancelled) setPrinters([]);
                } finally {
                    if (!cancelled) setDiscoveringPrinters(false);
                }
            };
            discover();
            return () => { cancelled = true; };
        }, [isOpen]);

        const handlePrefChange = (delta) => {
            const next = { ...prefs, ...delta };
            setPrefs(next);
            saveLabelPrefs(next);
        };

        const handleDirectPrint = async () => {
            if (!order?.id) return;
            if (!prefs.printerName) return;
            // Simple HTML snippet to print (single page). For multiple studies, we stack blocks.
            const html = `<div style="font-family:sans-serif;padding:4px;">${studies.map(s => {
                const patientName = order.patient_full_name || order.patient_name || order.patient?.full_name || 'Paciente';
                return `<div style='border:1px solid #000;margin:2px;padding:2px;font-size:11px;width:${activeSize.widthMm?activeSize.widthMm+'mm':activeSize.widthIn+'in'};'>
                <div style='font-weight:bold'>${patientName}</div>
                <div>Folio: ${order.folio}</div>
                ${order.order_date?`<div>Fecha: ${formatInTimeZone(order.order_date, 'dd/MM/yy')}</div>`:''}
                <div style='font-weight:600'>${s.name}</div>
                <div>Cont.: ${s.sample_container}</div>
                </div>`;
            }).join('')}</div>`;
            try {
                await printHtmlTo(prefs.printerName, html, {
                    size: activeSize.widthMm ? { width: `${activeSize.widthMm}mm`, height: `${activeSize.heightMm}mm` } : undefined,
                });
            } catch (e) {
                // Silently ignore; could surface toast if desired
                console.error('Direct print failed', e);
            }
        };

        const handlePrint = () => {
                if (!order?.id) return;
                const token = getToken();
                const hash = token ? `#at=${encodeURIComponent(token)}` : '';
                const printUrl = `/print/order-labels/${order.id}${hash}`;
                const w = window.open(printUrl, '_blank', 'noopener');
                // Intento complementario: enviar token vía postMessage (por si el hash es filtrado o se limpia antes)
                if (w && token) {
                    const send = () => {
                        try { w.postMessage({ type: 'LABG40_AUTH_TOKEN', token }, window.location.origin); } catch(_) { /* noop */ }
                    };
                    // Enviar de inmediato y reintentar un par de veces por si la pestaña aún inicia
                    send();
                    setTimeout(send, 150);
                    setTimeout(send, 450);
                }
        };
    
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-slate-50 dark:bg-slate-900 flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-sky-700 dark:text-sky-400">Imprimir Etiquetas</DialogTitle>
                    <DialogDescription>
                        Se abrirá una nueva pestaña para imprimir las etiquetas de la orden {order?.folio}.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow my-4">
                    {loadingPreview && (
                        <div className="text-sm text-slate-500">Cargando previsualización…</div>
                    )}
                    {previewError && (
                        <div className="text-sm text-red-600">{previewError}</div>
                    )}
                    {!loadingPreview && !previewError && studies.length === 0 && (
                        <div className="flex items-center justify-center">
                            <Printer className="h-20 w-20 text-slate-300 dark:text-slate-600" />
                        </div>
                    )}
                    {!loadingPreview && studies.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto">
                            {studies.map((s, i) => {
                                const patientName = order.patient_full_name || order.patient_name || order.patient?.full_name || 'Paciente';
                                return (
                                    <div key={i} className="border border-slate-300 rounded p-2 bg-white shadow-sm text-[11px] leading-tight">
                                        <p className="font-bold truncate text-xs">{patientName}</p>
                                        <p className="truncate">Folio: {order.folio}</p>
                                        {order.order_date && (
                                            <p className="truncate">Fecha: {formatInTimeZone(order.order_date, 'dd/MM/yy')}</p>
                                        )}
                                        <p className="font-semibold truncate">{s.name}</p>
                                        <p className="truncate">Cont.: {s.sample_container}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-4 space-y-3 text-xs">
                        <div>
                            <label className="block font-semibold mb-1">Impresora</label>
                            {discoveringPrinters && <div className="text-slate-500">Buscando impresoras…</div>}
                            {!discoveringPrinters && (
                                <select
                                    className="w-full border rounded px-2 py-1 bg-white"
                                    value={prefs.printerName || ''}
                                    onChange={(e) => handlePrefChange({ printerName: e.target.value })}
                                >
                                    <option value="">(Seleccionar)</option>
                                    {printers.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            )}
                        </div>
                        <div>
                            <label className="block font-semibold mb-1">Tamaño Etiqueta</label>
                            <select
                                className="w-full border rounded px-2 py-1 bg-white"
                                value={prefs.sizeId || 'vial_50x25'}
                                onChange={(e) => handlePrefChange({ sizeId: e.target.value })}
                            >
                                {LABEL_SIZE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>
                        {prefs.sizeId === 'custom' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block mb-1">Ancho (mm)</label>
                                    <input type="number" className="w-full border rounded px-2 py-1 bg-white" value={prefs.customWidthMm || ''} onChange={e => handlePrefChange({ customWidthMm: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block mb-1">Alto (mm)</label>
                                    <input type="number" className="w-full border rounded px-2 py-1 bg-white" value={prefs.customHeightMm || ''} onChange={e => handlePrefChange({ customHeightMm: e.target.value })} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
                     <DialogClose asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                            <X className="mr-2 h-4 w-4" /> Cerrar
                        </Button>
                    </DialogClose>
                    {prefs.printerName && studies.length > 0 && (
                        <Button onClick={handleDirectPrint} variant="secondary" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Printer className="mr-2 h-4 w-4" /> Imprimir Directo
                        </Button>
                    )}
                    <Button onClick={handlePrint} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                        <Printer className="mr-2 h-4 w-4" /> Continuar a Impresión
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default OrderLabelsPreviewModal;