export const defaultTemplates = [
  {
    name: 'Reporte de Resultados Estándar',
    type: 'result_report',
    content: `Estimado/a {{nombre_paciente}},\n\nA continuación se presentan los resultados de sus análisis:\n\n{{tabla_resultados}}\n\nAtentamente,\nEl Laboratorio`,
    header: '{{nombre_laboratorio}}\n{{direccion_laboratorio}}\nTel: {{telefono_laboratorio}}',
    footer: 'Resultados validados por: {{validador}}\nFecha de Emisión: {{fecha_emision}}',
    is_default: true,
    is_system: true,
  },
  {
    name: 'Consentimiento Informado General',
    type: 'consent_form',
    content: `Yo, {{nombre_paciente}}, con DNI {{dni_paciente}}, doy mi consentimiento para la realización de los análisis solicitados.\n\nFirma: ______________________`,
    header: 'Consentimiento Informado',
    footer: '{{nombre_laboratorio}} - {{fecha_actual}}',
    is_default: true,
    is_system: true,
  },
];

export const templateTypes = [
  { value: 'result_report', label: 'Reporte de Resultados' },
  { value: 'consent_form', label: 'Consentimiento Informado' },
  { value: 'labels', label: 'Etiquetas de Muestras' },
  { value: 'work_sheet', label: 'Hoja de Trabajo' },
  { value: 'other', label: 'Otro Documento' },
];

export const availablePlaceholders = {
  result_report: ['{{nombre_paciente}}', '{{dni_paciente}}', '{{edad_paciente}}', '{{sexo_paciente}}', '{{fecha_nacimiento_paciente}}', '{{folio_orden}}', '{{fecha_orden}}', '{{medico_referente}}', '{{nombre_estudio}}', '{{tabla_resultados}}', '{{nombre_laboratorio}}', '{{direccion_laboratorio}}', '{{telefono_laboratorio}}', '{{logo_laboratorio_url}}', '{{validador}}', '{{fecha_emision}}', '{{fecha_actual}}', '{{hora_actual}}'],
  consent_form: ['{{nombre_paciente}}', '{{dni_paciente}}', '{{edad_paciente}}', '{{sexo_paciente}}', '{{fecha_nacimiento_paciente}}', '{{folio_orden}}', '{{fecha_orden}}', '{{lista_estudios_solicitados}}', '{{nombre_laboratorio}}', '{{fecha_actual}}'],
  labels: ['{{nombre_paciente_corto}}', '{{folio_orden}}', '{{id_muestra}}', '{{tipo_muestra}}', '{{fecha_recoleccion_muestra}}', '{{codigo_barras_muestra}}'],
  work_sheet: ['{{nombre_estudio}}', '{{folio_orden}}', '{{id_muestra}}', '{{fecha_procesamiento}}', '{{tecnico_asignado}}'],
  other: ['{{nombre_paciente}}', '{{fecha_actual}}', '{{nombre_laboratorio}}'],
};