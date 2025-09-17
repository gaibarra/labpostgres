import jsPDF from 'jspdf';
import 'jspdf-autotable';

const LINE_HEIGHT = 1.25;
const P_SPACING = 10;

export const generateUserManualPDF = () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    let y = margin;

    const addPageIfNecessary = (requiredHeight) => {
        if (y + requiredHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };

    const addFooter = () => {
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`LabSys - El Futuro de tu Laboratorio`, margin, pageHeight - 20, { align: 'left' });
            doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
        }
    };
    
    const addTitle = (text, options = {}) => {
        const { size = 20, color = [15, 23, 42], spaceBefore = 25, spaceAfter = 15 } = options;
        y += spaceBefore;
        addPageIfNecessary(size + spaceAfter);
        doc.setFontSize(size);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(text, margin, y);
        y += size + spaceAfter;
    };

    const addSubTitle = (text, options = {}) => {
        const { size = 14, spaceBefore = 10, spaceAfter = 10 } = options;
        y += spaceBefore;
        addPageIfNecessary(size + spaceAfter);
        doc.setFontSize(size);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text(text, margin, y);
        y += spaceAfter;
    };

    const addParagraph = (text, options = {}) => {
        const { indent = 0, size = 10, isQuote = false, spaceAfter = P_SPACING } = options;
        const textWidth = contentWidth - indent;
        doc.setFontSize(size);
        doc.setFont(undefined, isQuote ? 'italic' : 'normal');
        doc.setTextColor(isQuote ? 82 : 71, 85, 105);

        const splitText = doc.splitTextToSize(text, textWidth);
        const requiredHeight = splitText.length * size * LINE_HEIGHT;
        addPageIfNecessary(requiredHeight + spaceAfter);
        
        const currentY = y;

        if (isQuote) {
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, currentY - size, contentWidth, requiredHeight + P_SPACING / 2, 'F');
        }

        doc.text(splitText, margin + indent, currentY);
        y = currentY + requiredHeight + spaceAfter;
    };
    
    const addListItem = (title, text) => {
        const icon = '🔹';
        const iconIndent = 20;
        const textWidth = contentWidth - iconIndent;

        doc.setFontSize(10);
        
        const fullTitle = `${title}:`;
        const titleLines = doc.splitTextToSize(fullTitle, textWidth);
        const titleHeight = titleLines.length * 10 * LINE_HEIGHT;
        
        const descLines = doc.splitTextToSize(text, textWidth);
        const descHeight = descLines.length * 10 * LINE_HEIGHT;

        const requiredHeight = titleHeight + descHeight + 5;
        addPageIfNecessary(requiredHeight);
        
        const startY = y;
        doc.setFont(undefined, 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text(icon, margin, startY + 8);
        doc.text(titleLines, margin + iconIndent, startY, { maxWidth: textWidth });
        
        const textY = startY + titleHeight;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(descLines, margin + iconIndent, textY, { maxWidth: textWidth });
        
        y = startY + requiredHeight;
    };
    
    const addSectionBreak = () => {
        y += 10;
        addPageIfNecessary(20);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 20;
    };
    
    const addHelpSection = (mainTitle, content) => {
        addTitle(mainTitle, { size: 18 });
        content.forEach(item => {
            addSubTitle(item.title);
            item.points.forEach(point => {
                if (typeof point === 'string') {
                    addParagraph(point, {spaceAfter: 5, indent: 15});
                } else {
                    addListItem(point.bold, point.text);
                }
            });
        });
        addSectionBreak();
    };

    addTitle("Bienvenido a LabSys", { size: 32 });
    addParagraph("La guía definitiva para transformar su laboratorio clínico en un modelo de eficiencia, crecimiento y excelencia.", { size: 14 });
    addParagraph("Este no es solo un manual; es el mapa para desbloquear todo el potencial de su negocio. LabSys ha sido diseñado desde cero para ir más allá de un simple sistema de gestión: es su socio estratégico.", { isQuote: true });
    
    addSectionBreak();

    const patientHelp = [
        { title: '✍️ Añadir y Editar Pacientes', points: [ "Usa el botón \"Nuevo Paciente\" para registrar todos los datos del paciente.", {bold: "Guardar y Registrar Orden", text: "Guarda al paciente y te redirige inmediatamente para crear una nueva orden."} ]},
        { title: '🔍 Búsqueda y Filtros', points: ["Usa la barra de búsqueda para encontrar pacientes por nombre, email o teléfono."]},
        { title: '⚙️ Acciones en la Tabla', points: [ {bold: '👁️ Ver Historial', text: 'Accede al historial clínico completo.'}, {bold: '✏️ Editar', text: 'Modifica los datos del paciente.'}, {bold: '🗑️ Eliminar', text: 'Borra el registro del paciente (requiere confirmación).'} ]}
    ];
    addHelpSection('👥 Gestión de Pacientes', patientHelp);

    const referrerHelp = [
        { title: '✍️ Añadir y Editar Referentes', points: [ "Usa \"Nuevo Referente\" para registrar médicos o instituciones. El referente 'Particular' es la base de precios y no puede ser editado.", ]},
        { title: '⚙️ Acciones en la Tabla', points: [ {bold: '✏️ Editar Datos', text: 'Modifica la información del referente.'}, {bold: '💲 Gestionar Precios', text: 'Crea listas de precios personalizadas.'}, {bold: '📄 Ver Lista (PDF)', text: 'Genera un PDF con la lista de precios.'}, {bold: '🗑️ Eliminar Referente', text: 'Borra permanentemente al referente.'} ]}
    ];
    addHelpSection('🤝 Gestión de Referentes', referrerHelp);
    
    addPageIfNecessary(200);

    const studyHelp = [
        { title: '🧪 Añadir y Editar Estudios', points: ["Usa \"Nuevo Estudio\" para definir nombres, categorías, parámetros y valores de referencia."]},
        { title: '🤖 Asistente de IA', points: ["\"Asistencia IA\" genera automáticamente la estructura de un estudio a partir de su nombre."]},
        { title: '💲 Gestión de Precios', points: [ {bold: 'Precio Base (Particular)', text: 'El precio definido en el formulario es el precio de lista.'}, {bold: 'Asignar Precios', text: 'Asigna precios diferentes a otros referentes usando el botón de la tabla.'} ]}
    ];
    addHelpSection('🔬 Catálogo de Estudios', studyHelp);
    
    const packageHelp = [
        { title: '📦 Crear y Editar Paquetes', points: ["Usa \"Nuevo Paquete\" para agrupar estudios individuales."]},
        { title: '💲 Gestión de Precios de Paquetes', points: ["El precio de un paquete se gestiona igual que un estudio: se establece un precio base y luego precios especiales por referente."]},
    ];
    addHelpSection('🎁 Gestión de Paquetes', packageHelp);
    
    addPageIfNecessary(400);
    
    addTitle("📋 El Ciclo de Vida de una Orden Perfecta");
    const orderHelp = [
        { title: '✍️ Crear y Editar Órdenes', points: ["Usa \"Nueva Orden\" para registrar una solicitud."]},
        { title: '📊 Estados de la Orden', points: ["Pendiente ➡️ Procesando ➡️ Concluida ➡️ Reportada."]},
        { title: '⚙️ Acciones Principales', points: [
            {bold: '📝 Registrar Resultados', text: 'Captura los valores obtenidos en el laboratorio.'},
            {bold: '🧾 Ver Comprobante', text: 'Genera un recibo de pago para el paciente.'},
            {bold: '📄 Hoja de Trabajo', text: 'Imprime una guía para el personal técnico.'},
            {bold: '🏷️ Imprimir Etiquetas', text: 'Genera etiquetas con códigos QR para las muestras.'},
            {bold: '📈 Ver Reporte Final', text: 'Visualiza e imprime el informe final de resultados.'},
            {bold: '🤖 Asistente IA', text: 'Ofrece análisis y recomendaciones adicionales sobre los resultados.'},
        ]}
    ];
    addHelpSection('🔄 Gestión de Órdenes', orderHelp);

    addPageIfNecessary(400);
    
    addTitle("🕹️ Paneles de Control: Su Torre de Mando");

    const adminHelp = [
        { title: '👥 Gestión de Usuarios', points: ["Crea, edita y elimina cuentas de usuario y asigna roles."]},
        { title: '🔐 Roles y Permisos', points: ["Define roles personalizados con permisos específicos."]},
        { title: '🗒️ Auditoría del Sistema', points: ["Rastrea todas las acciones importantes para seguridad y control."]},
        { title: '⚙️ Configuración General', points: ["Configura datos de la empresa, reportes, e integraciones."]},
        { title: '🎨 Plantillas y Reportes', points: ["Personaliza la apariencia de todos los documentos."]},
        { title: '🏢 Gestión de Sucursales', points: ["Administra múltiples sedes de forma centralizada."]}
    ];
    addHelpSection('🛡️ Panel de Administración', adminHelp);
    
    addPageIfNecessary(400);

    const financeHelp = [
        { title: '📈 Reporte de Ingresos', points: ["Analiza ingresos por fechas, estudios o referentes."]},
        { title: '💸 Control de Gastos', points: ["Registra y categoriza todos los gastos para optimizar costos."]},
        { title: '💰 Cuentas por Cobrar', points: ["Lleva un control de deudas y registra pagos."]},
        { title: '🧾 Facturación y Recibos', points: ["Genera recibos de pago y gestiona la facturación."]},
        { title: '📊 Configuración de Impuestos', points: ["Define los impuestos aplicables a tus servicios."]},
        { title: '🌊 Flujo de Caja', points: ["Monitorea en tiempo real las entradas y salidas de dinero."]}
    ];
    addHelpSection('💵 Panel de Finanzas', financeHelp);
    
    addPageIfNecessary(400);

    const marketingHelp = [
        { title: '📢 Campañas de Publicidad', points: ["Flujo: Estrategia ➡️ Creación ➡️ Gestión y Análisis."]},
        { title: '📱 Gestión de Redes Sociales', points: ["Flujo: Planificación ➡️ Creación y Programación ➡️ Publicación y Análisis."]},
        { title: '📧 Email Marketing', points: ["Flujo: Recopilación y Segmentación ➡️ Creación ➡️ Envío y Análisis."]},
        { title: '🌐 SEO y Contenido', points: ["Flujo: Investigación ➡️ Creación ➡️ Optimización y Monitoreo."]},
        { title: '⭐ Programas de Lealtad', points: ["Flujo: Diseño ➡️ Implementación ➡️ Comunicación y Análisis."]}
    ];
    addHelpSection('🎯 Marketing Digital Estratégico', marketingHelp);

    addFooter();
    return doc;
};