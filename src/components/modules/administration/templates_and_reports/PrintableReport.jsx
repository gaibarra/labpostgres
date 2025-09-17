import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PrintableReport = React.forwardRef(({ template, patient, workOrder, labSettings }, ref) => {
  const getAge = (dob) => {
    if (!dob) return '[Dato no disponible]';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} años`;
  };

  const replacePlaceholders = (text) => {
    if (!text) return '';
    let newText = text;

    const replacements = {
      // Patient data
      '{{nombre_paciente}}': patient?.full_name || '[Nombre Paciente]',
      '{{dni_paciente}}': patient?.id ? String(patient.id).substring(0, 8) : '[DNI Paciente]',
      '{{edad_paciente}}': getAge(patient?.date_of_birth),
      '{{sexo_paciente}}': patient?.sex || '[Sexo]',
      '{{fecha_nacimiento_paciente}}': patient?.date_of_birth ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy') : '[Fecha Nacimiento]',
      '{{nombre_paciente_corto}}': patient?.full_name?.split(' ')[0] || '[Paciente]',

      // Work Order data
      '{{folio_orden}}': workOrder?.folio || '[Folio]',
      '{{fecha_orden}}': workOrder?.order_date ? format(new Date(workOrder.order_date), 'dd/MM/yyyy') : '[Fecha Orden]',
      '{{medico_referente}}': workOrder?.referring_doctor?.name || '[Médico no especificado]',
      '{{lista_estudios_solicitados}}': workOrder?.selected_items?.map(item => item.nombre).join(', ') || '[Lista de estudios]',

      // Lab and General Data
      '{{nombre_laboratorio}}': labSettings?.labInfo?.name || '[Nombre Laboratorio]',
      '{{direccion_laboratorio}}': labSettings?.labInfo?.address || '[Dirección Laboratorio]',
      '{{telefono_laboratorio}}': labSettings?.labInfo?.phone || '[Teléfono Laboratorio]',
      '{{logo_laboratorio_url}}': labSettings?.labInfo?.logoUrl ? `<img src="${labSettings.labInfo.logoUrl}" alt="Logo" style="max-height: 80px;" />` : '',
      '{{validador}}': '[Nombre Validador]',
      '{{fecha_emision}}': format(new Date(), 'dd MMMM yyyy', { locale: es }),
      '{{fecha_actual}}': format(new Date(), 'dd/MM/yyyy'),
      '{{hora_actual}}': format(new Date(), 'HH:mm'),
      
      // Sample/Processing Data (example values)
      '{{nombre_estudio}}': '[Nombre del Estudio]',
      '{{tabla_resultados}}': '<p><i>Aquí se mostraría una tabla con resultados de ejemplo. La previsualización no genera resultados de estudios.</i></p>',
      '{{id_muestra}}': workOrder?.id ? `MUESTRA-${String(workOrder.id).substring(0, 8)}` : '[ID Muestra]',
      '{{tipo_muestra}}': '[Tipo de Muestra]',
      '{{fecha_recoleccion_muestra}}': workOrder?.order_date ? format(new Date(workOrder.order_date), 'dd/MM/yyyy') : '[Fecha Recolección]',
      '{{codigo_barras_muestra}}': workOrder?.folio ? `*${workOrder.folio}*` : '[Código Barras]',
      '{{fecha_procesamiento}}': format(new Date(), 'dd/MM/yyyy'),
      '{{tecnico_asignado}}': '[Técnico Asignado]',
    };

    Object.keys(replacements).forEach(placeholder => {
      const regex = new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
      newText = newText.replace(regex, replacements[placeholder]);
    });

    return newText;
  };

  const renderContent = (content) => {
    const replacedContent = replacePlaceholders(content);
    return <div dangerouslySetInnerHTML={{ __html: replacedContent.replace(/\n/g, '<br />') }} />;
  };

  if (!template) return null;

  return (
    <div ref={ref} className="p-8 font-sans text-sm text-black bg-white">
      {template.header && (
        <header className="border-b border-gray-300 pb-4 mb-4">
          {renderContent(template.header)}
        </header>
      )}
      <main className="py-4">
        {renderContent(template.content)}
      </main>
      {template.footer && (
        <footer className="border-t border-gray-300 pt-4 mt-4 text-xs">
          {renderContent(template.footer)}
        </footer>
      )}
    </div>
  );
});

export default PrintableReport;