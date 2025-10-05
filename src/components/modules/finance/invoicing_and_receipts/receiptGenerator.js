import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// Debug: verify plugin import mode
// (Will be removed once stable)
// eslint-disable-next-line no-console
console.debug('[receiptGenerator] Loaded module. typeof autoTable =', typeof autoTable);
    import { format, isValid } from 'date-fns';
    import { apiClient } from '@/lib/apiClient';
    import { amountToWords } from '@/lib/amountToWords';

    const getDetailedItems = (orderItems) => {
      return (orderItems || []).map(item => ({
          name: item.nombre || item.name,
          price: typeof item.precio === 'number' ? item.precio : (typeof item.price === 'number' ? item.price : 0)
      }));
    };

    // Helper para formatear dirección desde string u objeto con campos granulares
    const formatAddress = (labInfo) => {
      const addr = labInfo?.address;
      if (typeof addr === 'string' && addr.trim().length > 0) return addr;
      const street = labInfo?.calle || '';
      const extNo = labInfo?.numeroExterior || labInfo?.exterior || labInfo?.number || '';
      const intNo = labInfo?.numeroInterior || labInfo?.interior || labInfo?.int || '';
      const neighborhood = labInfo?.colonia || labInfo?.neighborhood || '';
      const postal = labInfo?.codigoPostal || labInfo?.postal || labInfo?.postal_code || '';
      const city = labInfo?.ciudad || labInfo?.city || '';
      const state = labInfo?.estado || labInfo?.state || '';
      const country = labInfo?.pais || labInfo?.country || '';
      const parts = [
        [street, extNo].filter(Boolean).join(' '),
        intNo ? `Int. ${intNo}` : '',
        neighborhood,
        postal ? `C.P. ${postal}` : '',
        city,
        state,
        country,
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : 'Dirección no configurada';
    };

    export const generateReceiptPDF = async (order) => {
      let labInfo = {};
      let taxInfo = {};
      try {
        const cfg = await apiClient.get('/config');
        labInfo = cfg?.labInfo || cfg?.lab_info || {};
        taxInfo = cfg?.tax_settings || cfg?.taxSettings || {};
      } catch (_) {
        // fallback to defaults silently
      }

  const doc = new jsPDF();
  // eslint-disable-next-line no-console
  console.debug('[receiptGenerator] New jsPDF instance created. Has doc.autoTable?', typeof doc.autoTable);
      doc.setFontSize(18);
      doc.text(labInfo.razonSocial || labInfo.name || "Laboratorio Clínico", 14, 22);
      doc.setFontSize(10);
      doc.text(`RFC: ${taxInfo.taxId || "XAXX010101000"}`, 14, 28);
      doc.text(formatAddress(labInfo), 14, 34);
      doc.text(`Tel: ${labInfo.phone || "Teléfono no configurado"}`, 14, 40);

      doc.setFontSize(16);
      doc.text("RECIBO DE PAGO", 105, 50, { align: 'center' });

      doc.setFontSize(10);
      doc.text(`Folio Orden: ${order.folio}`, 14, 60);
      doc.text(`Fecha Orden: ${isValid(order.fecha) ? format(order.fecha, 'dd/MM/yyyy') : 'Fecha inválida'}`, 14, 65);
      doc.text(`Paciente: ${order.patient?.full_name || 'N/A'}`, 14, 70);
      doc.text(`Email Paciente: ${order.patient?.email || 'N/A'}`, 14, 75);
      doc.text(`Fecha Recibo: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 140, 60);

      let finalY = 80;

      const tableColumn = ["Descripción", "Cantidad", "Precio Unitario", "Importe"];
      const detailedItems = getDetailedItems(order.selected_items);
      
      const tableRows = detailedItems.map(item => {
        const price = typeof item.price === 'number' ? item.price : 0;
        return [
          item.name || 'N/A',
          1,
          price.toFixed(2),
          price.toFixed(2)
        ];
      });

      if (tableRows.length > 0) {
  if (typeof autoTable !== 'function') {
          // Fallback: plugin failed to load; avoid crashing and still return a minimal PDF
          console.error('jspdf-autotable plugin not loaded; skipping items table');
        } else {
          autoTable(doc, {
          startY: 85,
          head: [tableColumn],
          body: tableRows,
          theme: 'striped',
          headStyles: { fillColor: [22, 160, 133] },
          });
          // eslint-disable-next-line no-console
          console.debug('[receiptGenerator] Table generated. lastAutoTable?', !!doc.lastAutoTable);
          finalY = doc.lastAutoTable.finalY + 10;
        }
      } else {
         doc.setFontSize(10);
         doc.text("No se detallaron estudios en esta orden.", 14, 90);
         finalY = 100;
      }
      
  const parsedTotal = Number(order.total_price);
  const totalAmount = Number.isFinite(parsedTotal) ? parsedTotal : 0;
      doc.setFontSize(12);
      doc.text("Total:", 140, finalY, { align: 'right' });
      doc.text(`${totalAmount.toFixed(2)} MXN`, 190, finalY, { align: 'right' });
      finalY += 7;

      const amountInWordsText = `(${amountToWords(totalAmount)})`;
      doc.setFontSize(8);
      doc.text(amountInWordsText, 190, finalY, { align: 'right' });
      finalY += 15;
      
      doc.setLineWidth(0.5);
      doc.line(70, finalY, 140, finalY);
      finalY += 5;
      doc.setFontSize(10);
      doc.text(labInfo.razonSocial || labInfo.name || "Firma del Laboratorio", 105, finalY, { align: 'center' });
      finalY += 10;

      doc.setFontSize(10);
      doc.text("Este es un recibo de pago simplificado y no tiene validez fiscal como CFDI.", 14, finalY);

      return doc.output('datauristring');
    };