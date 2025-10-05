import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const generateBillingReportPDF = (reportData) => {
  const { groupedData, grandTotal, institutionName, dateRange } = reportData;
  const doc = new jsPDF();

  const pageHeight = doc.internal.pageSize.height;
  let y = 15;

  const addHeader = () => {
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text('Reporte de Facturación', 14, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Institución: ${institutionName}`, 14, y);
    y += 6;
    doc.text(`Periodo: ${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`, 14, y);
    y += 10;
  };

  const addFooter = (pageNumber) => {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${pageNumber}`, doc.internal.pageSize.width - 20, pageHeight - 10);
    doc.text(`Generado el: ${format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: es })}`, 14, pageHeight - 10);
  };

  let pageNumber = 1;
  addHeader();
  addFooter(pageNumber);

  const tableBody = [];
  Object.entries(groupedData).forEach(([patientName, patientData]) => {
    const patientOrders = patientData.orders;
    const totalRowsForPatient = patientOrders.reduce((acc, order) => acc + order.selected_items.length, 0);

    patientOrders.forEach((order, orderIndex) => {
      order.selected_items.forEach((item, itemIndex) => {
        const row = [];
        if (orderIndex === 0 && itemIndex === 0) {
          row.push({ content: patientName, rowSpan: totalRowsForPatient, styles: { valign: 'top', fontStyle: 'bold' } });
        }
        if (itemIndex === 0) {
          row.push({ content: order.folio, rowSpan: order.selected_items.length, styles: { valign: 'top' } });
          row.push({ content: order.institution_reference || '-', rowSpan: order.selected_items.length, styles: { valign: 'top' } });
          row.push({ content: format(new Date(order.order_date), 'dd/MM/yyyy'), rowSpan: order.selected_items.length, styles: { valign: 'top' } });
        }
        row.push(item.nombre);
        row.push({ content: (item.precio || 0).toFixed(2), styles: { halign: 'right' } });
        tableBody.push(row);
      });
    });

    tableBody.push([
      { content: 'Subtotal Paciente:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230] } },
      { content: patientData.subtotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230] } }
    ]);
  });

  if (typeof autoTable === 'function') {
  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Paciente', styles: { fillColor: [200, 200, 200] } },
      { content: 'Folio Orden', styles: { fillColor: [200, 200, 200] } },
      { content: 'Referencia', styles: { fillColor: [200, 200, 200] } },
      { content: 'Fecha', styles: { fillColor: [200, 200, 200] } },
      { content: 'Estudio', styles: { fillColor: [200, 200, 200] } },
      { content: 'Costo (MXN)', styles: { halign: 'right', fillColor: [200, 200, 200] } }
    ]],
    body: tableBody,
    theme: 'grid',
    headStyles: { textColor: [0, 0, 0], fontStyle: 'bold' },
    didDrawPage: (data) => {
      addFooter(data.pageNumber);
      if (data.pageNumber > 1) {
        y = 15;
        addHeader();
      }
    },
  });
  y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 10;
  } else {
    // Fallback if plugin failed to attach
    doc.setFontSize(10);
    doc.text('Tabla no disponible (plugin jspdf-autotable no cargado).', 14, y);
    y += 10;
  }

  if (y + 20 > pageHeight) {
    doc.addPage();
    pageNumber++;
    y = 15;
    addHeader();
    addFooter(pageNumber);
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total a Facturar: ${grandTotal.toFixed(2)} MXN`, 14, y);

  doc.save(`Reporte_Facturacion_${institutionName.replace(/\s/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};