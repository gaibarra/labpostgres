import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';
import { Loader2, FileText, PlusCircle, Send, CheckCircle2, History, Printer, CalendarClock, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/apiClient';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useSettings } from '@/contexts/SettingsContext';

const initialQuoteState = {
  id: null,
  quote_number: '',
  referring_entity_id: '',
  status: 'Borrador',
  quote_date: new Date(),
  expires_at: null,
  descuento: 0,
  descuento_percent: 0,
  subtotal: 0,
  total_price: 0,
  notes: '',
  items: [],
};

const statusOptions = ['Borrador', 'Enviada', 'Aceptada', 'Expirada'];

const formatDate = (value) => {
  if (!value) return '';
  try {
    return format(new Date(value), 'PPP', { locale: es });
  } catch (_) {
    return '';
  }
};

const numberFormat = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
};

const buildPrintHtml = (quote, referrer, items, labInfo = {}, uiSettings = {}) => {
  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.item_name || '-'}</td>
      <td>${item.item_type === 'package' ? 'Paquete' : 'Estudio'}</td>
      <td style="text-align:right">$${numberFormat(item.base_price)}</td>
      <td style="text-align:right">$${numberFormat(item.discount_amount)}</td>
      <td style="text-align:right">$${numberFormat(item.final_price)}</td>
    </tr>
  `).join('');

  const logoUrl = labInfo?.logoUrl || uiSettings?.logoUrl || '';
  const omitLabNameText = !!uiSettings?.logoIncludesLabName;

  const formatAddress = (addr) => {
    if (!addr) return 'Dirección del Laboratorio';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      const street = addr.calle || addr.street || '';
      const extNo = addr.numeroExterior || addr.exterior || addr.number || '';
      const intNo = addr.numeroInterior || addr.interior || addr.int || '';
      const neighborhood = addr.colonia || addr.neighborhood || '';
      const postal = addr.codigoPostal || addr.postal || addr.postal_code || '';
      const city = addr.ciudad || addr.city || '';
      const state = addr.estado || addr.state || '';
      const country = addr.pais || addr.country || '';
      const parts = [
        [street, extNo].filter(Boolean).join(' '),
        intNo ? `Int. ${intNo}` : '',
        neighborhood,
        postal ? `CP ${postal}` : '',
        city,
        state,
        country,
      ].filter(Boolean);
      return parts.join(', ');
    }
    try { return String(addr); } catch { return 'Dirección del Laboratorio'; }
  };

  return `
    <html>
    <head>
      <title>Cotización ${quote.quote_number || ''}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        .report-header { display: flex; align-items: center; margin-bottom: 8px; }
        .report-logo { width: 120px; flex-shrink: 0; }
        .report-logo img { max-height: 56px; }
        .report-logo-placeholder { height: 56px; width: 120px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 12px; }
        .report-center { flex: 1; text-align: center; }
        .report-center h2 { font-size: 16px; margin: 0 0 2px; }
        .report-center p { margin: 0; font-size: 11px; }
        .report-spacer { width: 120px; flex-shrink: 0; }
        .meta-grid { border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; display: grid; grid-template-columns: 1fr 1fr; padding: 6px 0; margin-bottom: 12px; font-size: 12px; }
        .meta-col { padding: 0 8px; }
        .meta-col + .meta-col { border-left: 1px solid #94a3b8; }
        .meta-row { display: flex; margin-bottom: 2px; }
        .meta-label { font-weight: bold; width: 120px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin-top: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; }
        th { background: #f8fafc; text-align: left; }
        .meta { font-size: 12px; color: #475569; }
        .totals { margin-top: 16px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div class="report-logo">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo del Laboratorio" />` : `<div class="report-logo-placeholder">Logo</div>`}
        </div>
        <div class="report-center">
          ${!omitLabNameText ? `<h2>${labInfo?.name || 'Nombre del Laboratorio'}</h2>` : ''}
          <p>${formatAddress(labInfo?.address ?? {
            calle: labInfo?.calle,
            numeroExterior: labInfo?.numeroExterior,
            numeroInterior: labInfo?.numeroInterior,
            colonia: labInfo?.colonia,
            codigoPostal: labInfo?.codigoPostal,
            ciudad: labInfo?.ciudad,
            estado: labInfo?.estado,
            pais: labInfo?.pais,
          })}</p>
          <p>Tel: ${labInfo?.phone || 'Teléfono'} | Email: ${labInfo?.email || 'Email'}</p>
        </div>
        <div class="report-spacer"></div>
      </div>

      <div class="meta-grid">
        <div class="meta-col">
          <div class="meta-row"><span class="meta-label">REFERENTE:</span><span>${referrer?.name || 'N/A'}</span></div>
          <div class="meta-row"><span class="meta-label">ESTADO:</span><span>${quote.status || 'Borrador'}</span></div>
        </div>
        <div class="meta-col">
          <div class="meta-row"><span class="meta-label">FECHA:</span><span>${formatDate(quote.quote_date)}</span></div>
          <div class="meta-row"><span class="meta-label">VIGENCIA:</span><span>${quote.expires_at ? formatDate(quote.expires_at) : '—'}</span></div>
          <div class="meta-row"><span class="meta-label">FOLIO:</span><span>${quote.quote_number || '—'}</span></div>
        </div>
      </div>
      <h1>Cotización ${quote.quote_number || ''}</h1>
      <div class="meta">Referente: ${referrer?.name || 'N/A'} | Estado: ${quote.status} | Fecha: ${formatDate(quote.quote_date)}</div>
      ${quote.expires_at ? `<div class="meta">Vigencia hasta: ${formatDate(quote.expires_at)}</div>` : ''}
      <h2>Detalle</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Tipo</th>
            <th>Precio base</th>
            <th>Descuento</th>
            <th>Precio final</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="totals">
        <div>Subtotal: $${numberFormat(quote.subtotal)}</div>
        <div>Descuento global: $${numberFormat(quote.descuento)}</div>
        <strong>Total: $${numberFormat(quote.total_price)}</strong>
      </div>
    </body>
    </html>
  `;
};

const QuoteFormDialog = ({ open, onOpenChange, onSave, onDelete, referrers, studies, packagesData, initialQuote }) => {
  const [quote, setQuote] = useState(initialQuote || initialQuoteState);
  const isAccepted = quote.status === 'Aceptada';

  const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  useEffect(() => {
    if (open) {
      setQuote(initialQuote || { ...initialQuoteState, quote_date: new Date() });
    }
  }, [open, initialQuote]);

  const particularReferrer = useMemo(
    () => referrers.find(r => r.name?.toLowerCase() === 'particular'),
    [referrers]
  );

  const getPriceForItem = useCallback((itemId, itemType) => {
    const source = itemType === 'study' ? studies : packagesData;
    const itemData = source.find(item => item.id === itemId);
    if (!itemData) return 0;

    const priceListKey = itemType === 'study' ? 'studies' : 'packages';
    const findPrice = (list) => {
      if (!list || !Array.isArray(list[priceListKey])) return null;
      const entry = list[priceListKey].find(p => p.itemId === itemId);
      if (entry && entry.price !== null && entry.price !== undefined && parseFloat(entry.price) >= 0) {
        return parseFloat(entry.price);
      }
      return null;
    };

    const particularPrice = findPrice(particularReferrer?.listaprecios);
    return particularPrice !== null ? particularPrice : 0;
  }, [studies, packagesData, particularReferrer]);

  const recalcTotals = useCallback((currentQuote) => {
    const subtotal = currentQuote.items.reduce((sum, item) => sum + (Number(item.final_price) || 0), 0);
    let descuento = Number(currentQuote.descuento) || 0;
    let descuentoPercent = Number(currentQuote.descuento_percent) || 0;

    if (descuento <= 0 && descuentoPercent > 0) {
      descuento = (subtotal * descuentoPercent) / 100;
    } else if (descuentoPercent <= 0 && descuento > 0 && subtotal > 0) {
      descuentoPercent = (descuento / subtotal) * 100;
    }

    const total = Math.max(subtotal - descuento, 0);
    return { ...currentQuote, subtotal, descuento, descuento_percent: descuentoPercent, total_price: total };
  }, []);

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...quote, [name]: value };
    if (name === 'descuento' || name === 'descuento_percent') {
      setQuote(recalcTotals(updated));
      return;
    }
    setQuote(updated);
  };

  const handleDateChange = (name, value) => {
    setQuote(prev => ({ ...prev, [name]: value ? new Date(value) : null }));
  };

  const addItem = (itemType, itemId) => {
    const source = itemType === 'study' ? studies : packagesData;
    const itemData = source.find(item => item.id === itemId);
    if (!itemData) return;

    const basePrice = getPriceForItem(itemId, itemType);
    const newItem = {
      item_type: itemType,
      item_id: itemId,
      item_name: itemData.name,
      base_price: basePrice,
      discount_amount: 0,
      discount_percent: 0,
      final_price: basePrice,
      position: quote.items.length + 1,
    };

    setQuote(prev => recalcTotals({ ...prev, items: [...prev.items, newItem] }));
  };

  const removeItem = (index) => {
    const updatedItems = quote.items.filter((_, i) => i !== index).map((item, idx) => ({ ...item, position: idx + 1 }));
    setQuote(prev => recalcTotals({ ...prev, items: updatedItems }));
  };

  const updateItemField = (index, field, value) => {
    const updatedItems = quote.items.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, [field]: value };
      const basePrice = Number(updated.base_price) || 0;
      let discountAmount = Number(updated.discount_amount) || 0;
      let discountPercent = Number(updated.discount_percent) || 0;
      let finalPrice = Number(updated.final_price) || 0;

      if (field === 'discount_percent') {
        discountAmount = (basePrice * discountPercent) / 100;
        finalPrice = basePrice - discountAmount;
      }
      if (field === 'discount_amount') {
        discountPercent = basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;
        finalPrice = basePrice - discountAmount;
      }
      if (field === 'final_price') {
        discountAmount = basePrice - finalPrice;
        discountPercent = basePrice > 0 ? (discountAmount / basePrice) * 100 : 0;
      }

      return {
        ...updated,
        discount_amount: Math.max(discountAmount, 0),
        discount_percent: Math.max(discountPercent, 0),
        final_price: Math.max(finalPrice, 0),
      };
    });
    setQuote(prev => recalcTotals({ ...prev, items: updatedItems }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (isAccepted) return;
    const normalizedItems = (quote.items || []).map((item, index) => ({
      ...item,
      base_price: toNumber(item.base_price, 0),
      discount_amount: toNumber(item.discount_amount, 0),
      discount_percent: toNumber(item.discount_percent, 0),
      final_price: toNumber(item.final_price, 0),
      position: Number.isFinite(Number(item.position)) ? Number(item.position) : index + 1,
    }));

    const payload = recalcTotals({
      ...quote,
      descuento: toNumber(quote.descuento, 0),
      descuento_percent: toNumber(quote.descuento_percent, 0),
      items: normalizedItems,
    });
    onSave(payload);
  };

  const referrerOptions = referrers.map(r => ({ value: r.id, label: r.name || 'N/A' }));
  const studyOptions = studies.map(s => ({ value: s.id, label: `${s.name} (${s.clave || ''})` }));
  const packageOptions = packagesData.map(p => ({ value: p.id, label: p.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-slate-50 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-theme-midnight dark:text-theme-powder flex items-center gap-2">
            <FileText className="h-5 w-5 text-theme-celestial" />
            {quote.id ? 'Editar Cotización' : 'Nueva Cotización'}
          </DialogTitle>
          <DialogDescription>Define precios negociados y vigencia.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Folio</label>
              <Input name="quote_number" value={quote.quote_number || ''} readOnly disabled placeholder="Se genera automáticamente (COT-0001)" />
            </div>
            <div>
              <label className="text-sm font-medium">Referente</label>
              <SearchableSelect
                options={referrerOptions}
                value={quote.referring_entity_id || ''}
                onValueChange={(value) => setQuote(prev => ({ ...prev, referring_entity_id: value }))}
                placeholder="Selecciona referente..."
                searchPlaceholder="Buscar referente"
                notFoundMessage="Sin resultados"
                disabled={isAccepted}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Estado</label>
              <SearchableSelect
                options={statusOptions.map(s => ({ value: s, label: s }))}
                value={quote.status || 'Borrador'}
                onValueChange={(value) => setQuote(prev => ({ ...prev, status: value }))}
                placeholder="Estado"
                searchPlaceholder="Estado"
                notFoundMessage="Sin resultados"
                disabled={isAccepted}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Fecha</label>
              <Input
                type="date"
                value={quote.quote_date ? format(new Date(quote.quote_date), 'yyyy-MM-dd') : ''}
                onChange={(e) => handleDateChange('quote_date', e.target.value)}
                disabled={isAccepted}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Vigencia</label>
              <Input
                type="date"
                value={quote.expires_at ? format(new Date(quote.expires_at), 'yyyy-MM-dd') : ''}
                onChange={(e) => handleDateChange('expires_at', e.target.value)}
                disabled={isAccepted}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descuento global</label>
              <Input name="descuento" type="number" min="0" step="0.01" value={quote.descuento || 0} onChange={handleFieldChange} disabled={isAccepted} />
              <span className="text-xs text-muted-foreground">{numberFormat(quote.descuento_percent)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Notas</label>
              <Input name="notes" value={quote.notes || ''} onChange={handleFieldChange} placeholder="Notas internas" disabled={isAccepted} />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Agregar estudio</label>
                <SearchableSelect
                  options={studyOptions}
                  value=""
                  onValueChange={(value) => addItem('study', value)}
                  placeholder="Selecciona estudio..."
                  searchPlaceholder="Buscar estudio"
                  notFoundMessage="Sin resultados"
                  disabled={isAccepted}
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Agregar paquete</label>
                <SearchableSelect
                  options={packageOptions}
                  value=""
                  onValueChange={(value) => addItem('package', value)}
                  placeholder="Selecciona paquete..."
                  searchPlaceholder="Buscar paquete"
                  notFoundMessage="Sin resultados"
                  disabled={isAccepted}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-theme-powder dark:border-theme-davy">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Desc. ($)</TableHead>
                  <TableHead>Desc. (%)</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Sin items</TableCell>
                  </TableRow>
                ) : quote.items.map((item, index) => (
                  <TableRow key={`${item.item_id}-${index}`}>
                    <TableCell>
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-xs text-muted-foreground">{item.item_type === 'package' ? 'Paquete' : 'Estudio'}</div>
                    </TableCell>
                    <TableCell>${numberFormat(item.base_price)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.discount_amount || 0}
                        onChange={(e) => updateItemField(index, 'discount_amount', e.target.value)}
                        className="w-28"
                        disabled={isAccepted}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.discount_percent || 0}
                        onChange={(e) => updateItemField(index, 'discount_percent', e.target.value)}
                        className="w-24"
                        disabled={isAccepted}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.final_price || 0}
                        onChange={(e) => updateItemField(index, 'final_price', e.target.value)}
                        className="w-28"
                        disabled={isAccepted}
                      />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" onClick={() => removeItem(index)} disabled={isAccepted}>Eliminar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap justify-end gap-6 text-sm text-muted-foreground">
            <div>Subtotal: <span className="font-semibold text-theme-midnight dark:text-theme-powder">${numberFormat(quote.subtotal)}</span></div>
            <div>Descuento global: <span className="font-semibold text-theme-midnight dark:text-theme-powder">${numberFormat(quote.descuento)}</span></div>
            <div>Total: <span className="font-semibold text-theme-midnight dark:text-theme-powder">${numberFormat(quote.total_price)}</span></div>
          </div>

          {isAccepted && (
            <div className="text-xs text-muted-foreground">
              Esta cotización está aceptada. No se permite editarla ni eliminarla.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {quote.id && quote.status !== 'Aceptada' && (
              <Button type="button" variant="destructive" onClick={() => onDelete(quote.id)}>Eliminar</Button>
            )}
            <Button type="submit" className="bg-gradient-to-r from-theme-celestial to-theme-midnight text-white" disabled={isAccepted}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const QuoteHistoryDialog = ({ open, onOpenChange, quoteId }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState([]);
  const [events, setEvents] = useState([]);

  const fetchHistory = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      const [versionsResp, eventsResp] = await Promise.all([
        apiClient.get(`/quotes/${quoteId}/versions`),
        apiClient.get(`/quotes/${quoteId}/events`)
      ]);
      setVersions(versionsResp?.versions || []);
      setEvents(eventsResp?.items || []);
    } catch (error) {
      toast({ title: 'Error cargando historial', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [quoteId, toast]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  const latest = versions[0];
  const previous = versions[1];
  const latestSnapshot = latest?.snapshot?.quote || latest?.snapshot || {};
  const previousSnapshot = previous?.snapshot?.quote || previous?.snapshot || {};

  const fieldDiffs = useMemo(() => {
    const fields = [
      { key: 'status', label: 'Estado' },
      { key: 'quote_date', label: 'Fecha' },
      { key: 'expires_at', label: 'Vigencia' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'descuento', label: 'Descuento' },
      { key: 'total_price', label: 'Total' },
    ];
    if (!latest || !previous) return [];
    return fields.map(field => {
      const beforeVal = previousSnapshot[field.key];
      const afterVal = latestSnapshot[field.key];
      const changed = String(beforeVal ?? '') !== String(afterVal ?? '');
      return { ...field, beforeVal, afterVal, changed };
    }).filter(diff => diff.changed);
  }, [latest, previous, latestSnapshot, previousSnapshot]);

  const itemDiffs = useMemo(() => {
    if (!latest || !previous) return [];
    const latestItems = latest.items || [];
    const previousItems = previous.items || [];
    const prevMap = new Map(previousItems.map(item => [`${item.item_type}:${item.item_id}`, item]));
    const latestMap = new Map(latestItems.map(item => [`${item.item_type}:${item.item_id}`, item]));

    const diffs = [];
    latestItems.forEach(item => {
      const key = `${item.item_type}:${item.item_id}`;
      const prev = prevMap.get(key);
      if (!prev) {
        diffs.push({ type: 'added', item });
      } else if (Number(prev.final_price) !== Number(item.final_price)) {
        diffs.push({ type: 'modified', item, prev });
      }
    });
    previousItems.forEach(item => {
      const key = `${item.item_type}:${item.item_id}`;
      if (!latestMap.has(key)) {
        diffs.push({ type: 'removed', item });
      }
    });
    return diffs;
  }, [latest, previous]);

  const tagStyles = {
    added: 'bg-theme-celestial/20 text-theme-celestial-dark border-theme-celestial/40',
    removed: 'bg-red-100 text-red-600 border-red-200',
    modified: 'bg-theme-midnight/10 text-theme-midnight border-theme-midnight/30',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-slate-50 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-theme-midnight dark:text-theme-powder">
            <History className="h-5 w-5 text-theme-celestial" /> Historial de cambios
          </DialogTitle>
          <DialogDescription>Comparación última versión vs anterior.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-theme-powder dark:border-theme-davy p-4">
              <h3 className="text-sm font-semibold text-theme-midnight dark:text-theme-powder">Cambios en totales y campos</h3>
              {fieldDiffs.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">Sin cambios en campos principales.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {fieldDiffs.map(diff => (
                    <div key={diff.key} className="flex justify-between text-sm">
                      <span>{diff.label}</span>
                      <span className="text-muted-foreground">{diff.beforeVal ?? '-'} → <span className="text-theme-midnight dark:text-theme-powder">{diff.afterVal ?? '-'}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-theme-powder dark:border-theme-davy p-4">
              <h3 className="text-sm font-semibold text-theme-midnight dark:text-theme-powder">Cambios en ítems</h3>
              {itemDiffs.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">Sin cambios en ítems.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {itemDiffs.map((diff, index) => (
                    <div key={`${diff.type}-${index}`} className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{diff.item.item_name || 'Sin nombre'}</div>
                        {diff.type === 'modified' && (
                          <div className="text-xs text-muted-foreground">
                            ${numberFormat(diff.prev.final_price)} → ${numberFormat(diff.item.final_price)}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className={tagStyles[diff.type]}>
                        {diff.type === 'added' ? 'Agregado' : diff.type === 'removed' ? 'Eliminado' : 'Modificado'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-theme-powder dark:border-theme-davy p-4">
              <h3 className="text-sm font-semibold text-theme-midnight dark:text-theme-powder">Eventos</h3>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">Sin eventos registrados.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {events.map(event => (
                    <div key={event.id} className="flex justify-between text-sm">
                      <span className="capitalize">{event.action}</span>
                      <span className="text-muted-foreground">{formatDate(event.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Quotes = () => {
  const { toast } = useToast();
  const { settings } = useSettings();
  const location = useLocation();
  const [quotes, setQuotes] = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [studies, setStudies] = useState([]);
  const [packagesData, setPackagesData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeQuote, setActiveQuote] = useState(null);
  const [historyQuoteId, setHistoryQuoteId] = useState(null);

  const referrerQuery = useMemo(() => new URLSearchParams(location.search).get('referrerId'), [location.search]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [quotesResp, refResp, studiesResp, packagesResp] = await Promise.all([
        apiClient.get('/quotes?limit=5000'),
        apiClient.get('/referrers?limit=5000'),
        apiClient.get('/analysis?limit=5000'),
        apiClient.get('/packages?limit=5000'),
      ]);
      setQuotes(quotesResp?.data || []);
      setReferrers(refResp?.data || []);
      setStudies((studiesResp?.data || []).map(s => ({ id: s.id, name: s.name, clave: s.clave })));
      setPackagesData((packagesResp?.data || []).map(p => ({ id: p.id, name: p.name, items: p.items || [] })));
    } catch (error) {
      toast({ title: 'Error al cargar cotizaciones', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (referrerQuery && referrers.length) {
      setActiveQuote({ ...initialQuoteState, referring_entity_id: referrerQuery });
      setIsFormOpen(true);
    }
  }, [referrerQuery, referrers.length]);

  const handleSave = async (quoteData) => {
    try {
      if (quoteData.id) {
        await apiClient.put(`/quotes/${quoteData.id}`, quoteData);
        toast({ title: 'Cotización actualizada', description: 'Se guardaron los cambios.' });
      } else {
        await apiClient.post('/quotes', quoteData);
        toast({ title: 'Cotización creada', description: 'Se creó la cotización.' });
      }
      await fetchData();
      setIsFormOpen(false);
      setActiveQuote(null);
    } catch (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    }
  };

  const handleSend = async (quoteId) => {
    try {
      await apiClient.post(`/quotes/${quoteId}/send`, { reason: 'Impresión/PDF' });
      toast({ title: 'Cotización enviada', description: 'Se registró el envío.' });
      await fetchData();
    } catch (error) {
      toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
    }
  };

  const handleAccept = async (quoteId) => {
    try {
      await apiClient.post(`/quotes/${quoteId}/accept`);
      toast({ title: 'Cotización aceptada', description: 'Se actualizó la lista de precios.' });
      await fetchData();
    } catch (error) {
      toast({ title: 'Error al aceptar', description: error.message, variant: 'destructive' });
    }
  };

  const handleExtend = async (quoteId) => {
    const newDate = window.prompt('Nueva fecha de vigencia (YYYY-MM-DD)');
    if (!newDate) return;
    try {
      await apiClient.post(`/quotes/${quoteId}/extend`, { expires_at: new Date(newDate).toISOString() });
      toast({ title: 'Vigencia prorrogada', description: 'Se registró la prórroga.' });
      await fetchData();
    } catch (error) {
      toast({ title: 'Error al prorrogar', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (quoteId) => {
    if (!window.confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.')) return;
    try {
      await apiClient.delete(`/quotes/${quoteId}`);
      toast({ title: 'Cotización eliminada', description: 'Se eliminó correctamente.' });
      await fetchData();
    } catch (error) {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    }
  };

  const handlePrint = (quote) => {
    const referrer = referrers.find(r => r.id === quote.referring_entity_id);
    const html = buildPrintHtml(quote, referrer, quote.items || [], settings?.labInfo, settings?.uiSettings);
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    handleSend(quote.id);
  };

  const openHistory = (quoteId) => {
    setHistoryQuoteId(quoteId);
    setIsHistoryOpen(true);
  };

  const filteredQuotes = quotes.filter(quote => {
    const term = searchTerm.toLowerCase();
    const refName = quote.referrer_name || '';
    return (
      quote.quote_number?.toLowerCase().includes(term) ||
      quote.status?.toLowerCase().includes(term) ||
      refName.toLowerCase().includes(term)
    );
  });

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="shadow-xl glass-card">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-2xl font-bold text-theme-midnight dark:text-theme-powder">Cotizaciones</CardTitle>
            <p className="text-sm text-muted-foreground">Gestiona precios negociados y vigencias.</p>
          </div>
          <div className="flex items-center gap-3">
            <Input placeholder="Buscar" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs" />
            <Button onClick={() => { setActiveQuote(null); setIsFormOpen(true); }} className="bg-gradient-to-r from-theme-celestial to-theme-midnight text-white">
              <PlusCircle className="h-4 w-4 mr-2" /> Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <ScrollArea className="h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Referente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Sin cotizaciones</TableCell>
                    </TableRow>
                  ) : filteredQuotes.map(quote => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quote_number || '—'}</TableCell>
                      <TableCell>{quote.referrer_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-theme-powder text-theme-midnight dark:text-theme-powder">
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(quote.quote_date)}</TableCell>
                      <TableCell>{quote.expires_at ? formatDate(quote.expires_at) : '—'}</TableCell>
                      <TableCell>${numberFormat(quote.total_price)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={async () => {
                          const fullQuote = await apiClient.get(`/quotes/${quote.id}`);
                          setActiveQuote(fullQuote);
                          setIsFormOpen(true);
                        }}>
                          <FileText className="h-4 w-4 text-sky-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openHistory(quote.id)}>
                          <History className="h-4 w-4 text-violet-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleExtend(quote.id)}>
                          <CalendarClock className="h-4 w-4 text-amber-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          const fullQuote = await apiClient.get(`/quotes/${quote.id}`);
                          handlePrint(fullQuote);
                        }}>
                          <Printer className="h-4 w-4 text-slate-700" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleSend(quote.id)}>
                          <Send className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleAccept(quote.id)}>
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        </Button>
                        {quote.status !== 'Aceptada' && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(quote.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">Total: {filteredQuotes.length}</CardFooter>
      </Card>

      <QuoteFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSave}
        onDelete={handleDelete}
        referrers={referrers}
        studies={studies}
        packagesData={packagesData}
        initialQuote={activeQuote}
      />

      <QuoteHistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        quoteId={historyQuoteId}
      />
    </motion.div>
  );
};

export default Quotes;
