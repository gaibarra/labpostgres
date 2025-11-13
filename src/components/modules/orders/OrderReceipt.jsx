import React from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { formatInTimeZone } from '@/lib/dateUtils';

export const OrderReceipt = React.forwardRef(({ order, patient, referrer, studiesDetails, packagesData }, ref) => {
  const { settings } = useSettings();
  const labInfo = settings.labInfo || {};
  const reportSettings = settings.reportSettings || {};
  const uiSettings = settings.uiSettings || {};

  // Normalized lab fields (support both modern and legacy keys)
  const labName = labInfo.name || labInfo.nombreComercial || 'Laboratorio Clínico';
  const labRFC = labInfo.taxId || labInfo.rfc || '';
  const labPhone = labInfo.phone || labInfo.telefonoPrincipal || labInfo.secondaryPhone || labInfo.telefono || '';
  const labEmail = labInfo.email || '';
  const labWebsite = labInfo.website || '';

  // Helper: convierte a número de forma segura (strings, null, undefined)
  const num = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'string' && v.trim() === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Helper: formatea dirección (acepta string u objeto con varias claves comunes)
  const formatAddress = (addr) => {
    if (!addr) return '';
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
    try { return String(addr); } catch { return ''; }
  };

  const renderOrderItems = (items, currentStudiesDetails, currentPackagesData, indentLevel = 0, visitedPackages = new Set()) => {
    if (!items) return [];
    
    let displayItems = [];

    items.forEach((item, index) => {
      const itemKey = `${item.id}-${item.type}-${index}-${indentLevel}`;
      if (item.type === 'study') {
        const studyDetail = currentStudiesDetails?.find(s => s.id === item.id);
        displayItems.push(
          <tr key={itemKey}>
            <td style={{ paddingLeft: `${indentLevel * 15}px` }}>Estudio</td>
            <td>{item.nombre}{studyDetail?.clave ? ` (${studyDetail.clave})` : ''}</td>
            <td className="text-right">{parseFloat(item.precio).toFixed(2)}</td>
          </tr>
        );
      } else if (item.type === 'package') {
        if (visitedPackages.has(item.id)) {
          return;
        }

        const packageDetail = currentPackagesData?.find(p => p.id === item.id);
        displayItems.push(
          <tr key={itemKey} className="font-semibold">
            <td style={{ paddingLeft: `${indentLevel * 15}px` }}>Paquete</td>
            <td>{item.nombre}</td>
            <td className="text-right">{parseFloat(item.precio).toFixed(2)}</td>
          </tr>
        );

        if (packageDetail?.items && packageDetail.items.length > 0) {
          const newVisitedPackages = new Set(visitedPackages);
          newVisitedPackages.add(item.id);
          
          const subItems = packageDetail.items.map(subItem => {
            const subItemDetail = subItem.item_type === 'study' 
              ? currentStudiesDetails?.find(s => s.id === subItem.item_id)
              : currentPackagesData?.find(p => p.id === subItem.item_id);
            return {
              id: subItem.item_id,
              type: subItem.item_type,
              nombre: subItemDetail?.name || 'Item desconocido',
              precio: 0
            };
          });
          displayItems = displayItems.concat(renderOrderItems(subItems, currentStudiesDetails, currentPackagesData, indentLevel + 1, newVisitedPackages));
        }
      }
    });
    return displayItems;
  };

  const items = Array.isArray(order?.selected_items) ? order.selected_items : [];
  const subtotal = items.reduce((sum, item) => sum + num(item?.precio), 0);
  const descuento = num(order?.descuento);
  const anticipo = num(order?.anticipo);
  const total = subtotal - descuento;
  const saldoPendiente = total - anticipo;

  return (
    <div ref={ref} className="p-8 font-sans text-sm text-black bg-white">
      <header className="flex items-center mb-8 border-b pb-4">
        {/* Columna izquierda: logo con ancho fijo para mantener el centrado */}
        <div className="w-32 flex-shrink-0 flex items-center">
          {reportSettings.showLogo !== false && (labInfo.logoUrl || uiSettings.logoUrl) && (
            <img
              src={labInfo.logoUrl || uiSettings.logoUrl}
              alt="Logo del Laboratorio"
              className="print-logo"
              style={{ maxHeight: '64px', height: 'auto', width: 'auto', objectFit: 'contain' }}
            />
          )}
        </div>
        {/* Centro: datos del laboratorio completamente centrados */}
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold">{labName}</h1>
          <p>{formatAddress(labInfo.address ?? {
            calle: labInfo.calle,
            numeroExterior: labInfo.numeroExterior,
            numeroInterior: labInfo.numeroInterior,
            colonia: labInfo.colonia,
            codigoPostal: labInfo.codigoPostal,
            ciudad: labInfo.ciudad,
            estado: labInfo.estado,
            pais: labInfo.pais,
          })}</p>
          {(labPhone || labEmail || labWebsite) && (
            <p>
              {labPhone ? `Tel: ${labPhone}` : ''}
              {labEmail ? `${labPhone ? ' · ' : ''}${labEmail}` : ''}
              {labWebsite ? `${labPhone || labEmail ? ' · ' : ''}${labWebsite}` : ''}
            </p>
          )}
        </div>
        {/* Columna derecha: separador invisible con el mismo ancho del logo para balancear el centrado */}
        <div className="w-32 flex-shrink-0" />
      </header>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-center mb-4">Comprobante de Orden de Trabajo</h2>
        <div className="grid grid-cols-2 gap-4 border p-4 rounded">
          <div>
            <p><span className="font-semibold">Folio:</span> {order.folio}</p>
            <p><span className="font-semibold">Fecha:</span> {formatInTimeZone(order.order_date, "dd/MM/yyyy HH:mm")}</p>
          </div>
          <div className="text-right">
             <p><span className="font-semibold">Estado:</span> {order.status}</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-semibold border-b mb-2">Paciente</h3>
          <p>{patient?.full_name || 'N/A'}</p>
          <p>{patient?.email || ''}</p>
        </div>
        <div>
          <h3 className="font-semibold border-b mb-2">Referente</h3>
          <p>{referrer?.name || 'N/A'}</p>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="font-semibold border-b mb-2">Detalle de la Orden</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1">Tipo</th>
              <th className="text-left py-1">Nombre</th>
              <th className="text-right py-1">Precio (MXN)</th>
            </tr>
          </thead>
          <tbody>
            {renderOrderItems(order.selected_items, studiesDetails, packagesData)}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-1/2">
          <table className="w-full">
            <tbody>
              <tr><td className="py-1">Subtotal:</td><td className="text-right py-1">{subtotal.toFixed(2)}</td></tr>
              <tr><td className="py-1">Descuento:</td><td className="text-right py-1">{descuento.toFixed(2)}</td></tr>
              <tr className="font-bold border-t"><td className="py-1">Total:</td><td className="text-right py-1">{total.toFixed(2)}</td></tr>
              <tr><td className="py-1">Anticipo:</td><td className="text-right py-1">{anticipo.toFixed(2)}</td></tr>
              <tr className="font-semibold border-t"><td className="py-1">Saldo Pendiente:</td><td className="text-right py-1">{saldoPendiente.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {order.notas && (
        <div className="mt-8">
          <h3 className="font-semibold">Notas Adicionales:</h3>
          <p className="text-xs p-2 border rounded">{order.notas}</p>
        </div>
      )}

      <footer className="text-center text-xs text-gray-500 mt-12 pt-4 border-t">
        <p>Gracias por su preferencia.</p>
  <p>{labName}{labInfo.razonSocial ? ` - ${labInfo.razonSocial}` : ''}{labRFC ? ` - RFC: ${labRFC}` : ''}</p>
      </footer>
    </div>
  );
});
OrderReceipt.displayName = 'OrderReceipt';