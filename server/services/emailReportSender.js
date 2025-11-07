const nodemailer = require('nodemailer');
const jsPDF = require('jspdf');
require('jspdf-autotable');

// Minimal PDF generator (server-side) to include summary of results.
function buildReportPdf({ order, patient, labName }) {
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text(labName || 'Resultados de Laboratorio', 14, 18);
  doc.setFontSize(11);
  doc.text(`Folio: ${order.folio}`, 14, 28);
  doc.text(`Paciente: ${patient.full_name}`, 14, 34);
  if (patient.sex) doc.text(`Sexo: ${patient.sex}`, 14, 40);
  if (order.order_date) doc.text(`Fecha Orden: ${new Date(order.order_date).toLocaleString()}`, 14, 46);
  const resultsKeys = Object.keys(order.results || {});
  let y = 56;
  doc.setFontSize(12); doc.text('Resumen de Parámetros', 14, y); y += 6;
  resultsKeys.forEach(key => {
    const bucket = order.results[key];
    if (!Array.isArray(bucket)) return;
    doc.setFontSize(11); doc.text(String(key), 14, y); y += 5;
    bucket.slice(0, 12).forEach(r => { // Limit lines to keep PDF small
      doc.setFontSize(9);
      const line = `${r.parametroNombre || r.parameterName || r.parametroId}: ${r.valor ?? 'PENDIENTE'}`;
      doc.text(line.substring(0,80), 18, y); y += 4;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    y += 2;
    if (y > 280) { doc.addPage(); y = 20; }
  });
  return doc.output('arraybuffer');
}

async function createTransport({ host, port, secure, user, pass }) {
  return nodemailer.createTransport({
    host,
    port: Number(port) || 587,
    secure: Boolean(secure),
    auth: { user, pass }
  });
}

async function sendReportEmail({ smtp, to, order, patient, labName }) {
  if (!to) throw new Error('Destinatario (to) requerido');
  const transporter = await createTransport(smtp);
  const pdfBuffer = Buffer.from(buildReportPdf({ order, patient, labName }));
  const subject = `Resultados Laboratorio - ${patient.full_name} - Folio ${order.folio}`;
  const text = `Adjunto PDF con el reporte de resultados. Folio ${order.folio}. Paciente ${patient.full_name}.`;
  const info = await transporter.sendMail({
    from: smtp.user,
    to,
    subject,
    text,
    attachments: [
      { filename: `reporte-${order.folio}.pdf`, content: pdfBuffer }
    ]
  });
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

module.exports = { sendReportEmail };