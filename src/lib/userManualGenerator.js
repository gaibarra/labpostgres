import { loadJsPdf } from '@/lib/dynamicImports';

const LINE_HEIGHT = 1.25;
const P_SPACING = 10;

export const generateUserManualPDF = async () => {
    const { jsPDF } = await loadJsPdf();
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
            doc.text(`LabG40 - El Futuro de tu Laboratorio`, margin, pageHeight - 20, { align: 'left' });
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
    
    const addAlert = (title, text) => {
        const padding = 14;
        const icon = '⚠️';
        const textBlock = doc.splitTextToSize(text, contentWidth - padding * 2 - 20);
        const height = (textBlock.length + 1) * 10 * LINE_HEIGHT + padding * 2;
        addPageIfNecessary(height + 10);
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(248, 113, 113);
        doc.roundedRect(margin, y, contentWidth, height, 6, 6, 'FD');
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text(`${icon} ${title}`, margin + padding, y + padding + 4);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(120, 53, 15);
        doc.text(textBlock, margin + padding, y + padding + 20, { maxWidth: contentWidth - padding * 2 });
        y += height + 10;
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

    addTitle("Bienvenido a LabG40", { size: 32 });
    addParagraph("Manual actualizado con las últimas capacidades de LabG40 para operación multitenant, asistentes de IA y automatización de flujos críticos.", { size: 14 });
    addParagraph("LabG40 integra catálogos clínicos dinámicos, análisis financiero en tiempo real y omnicanalidad para pacientes, referentes y personal interno. Este documento describe la experiencia end-to-end para que cada rol pueda ejecutar con consistencia.", { isQuote: true });
    addAlert('Validación obligatoria de parámetros', 'Los parámetros sugeridos por el asistente de IA y los valores de referencia generados automáticamente deben ser revisados y validados por un especialista clínico antes de publicarse o entregarse a pacientes. LabG40 facilita la creación, pero la responsabilidad final recae en el laboratorio.');
    
    addSectionBreak();

    addTitle('🚀 Guía rápida de adopción', { size: 20 });
    const quickStart = [
        { title: '1. Configura tu tenant', text: 'Ejecuta el aprovisionamiento, crea el usuario admin, verifica que los perfiles y paquetes estén sincronizados y activa las plantillas de mail.' },
        { title: '2. Define catálogo base', text: 'Complementa o corrige los estudios precargados, valida rangos y agrega paquetes propios. Usa el asistente de IA solo como punto de partida.' },
        { title: '3. Carga pacientes y referentes', text: 'Importa desde CSV o crea manualmente. Configura precios especiales para clientes frecuentes.' },
        { title: '4. Entrena a tu equipo', text: 'Recorre el flujo completo: orden → resultados → publicación, y revisa los paneles de auditoría.' }
    ];
    quickStart.forEach(item => addListItem(item.title, item.text));

    addSectionBreak();

    const patientHelp = [
        { title: '✍️ Añadir y Editar Pacientes', points: [ "'Nuevo Paciente' registra datos demográficos, notas clínicas y preferencias. El botón 'Guardar y crear orden' acelera la admisión.", {bold: "Historial clínico inteligente", text: "Cada paciente agrega automáticamente órdenes, resultados y archivos adjuntos consultables."} ]},
        { title: '🔍 Búsqueda y segmentación', points: ["Filtra por nombre, email, etiquetas clínicas o rango de fecha de última visita. La búsqueda tolera acentos y mayúsculas."]},
        { title: '⚙️ Acciones rápidas', points: [ {bold: '👁️ Ver resumen', text: 'Abre una vista lateral con datos clave, alergias y órdenes recientes.'}, {bold: '📎 Adjuntar documentos', text: 'Carga consentimientos o recetas firmadas.'}, {bold: '🗑️ Desactivar registro', text: 'Oculta pacientes obsoletos (soft delete con trazabilidad).'} ]}
    ];
    addHelpSection('👥 Gestión de Pacientes', patientHelp);

    const referrerHelp = [
        { title: '✍️ Registrar referentes', points: [ "'Nuevo Referente' soporta médicos, aseguradoras y convenios corporativos. El referente 'Particular' permanece protegido como lista base." ]},
        { title: '💲 Listas dinámicas de precios', points: [ {bold: 'Tarifario personalizado', text: 'Define estudios o paquetes con precios específicos por referente y moneda.'}, {bold: 'Exportación inmediata', text: 'Genera PDF o CSV de la lista vigente para compartir con tu aliado.'} ]},
        { title: '🔐 Accesos y comunicación', points: [ "Habilita credenciales para que el referente descargue resultados desde el portal seguro y recibe alertas cuando se publique una orden."]}
    ];
    addHelpSection('🤝 Gestión de Referentes', referrerHelp);
    
    addPageIfNecessary(200);

    const studyHelp = [
        { title: '🧪 Definición de estudios', points: ["El formulario permite nombre, categoría, código, unidades, tiempos y notas clínicas. Puedes clonar estudios existentes para acelerar la configuración." ]},
        { title: '🤖 Asistencia de IA', points: ["El asistente genera parámetros y rangos sugeridos a partir del nombre del estudio. Usa el resultado como borrador y ajusta según tus criterios profesionales.", {bold: 'Verificación experta', text: 'Antes de publicar un estudio debes validar manualmente los parámetros y valores de referencia.'}]},
        { title: '📚 Versionado y publicación', points: [ "Guarda borradores sin exponerlos al catálogo, documenta cambios y publica cuando el comité lo autorice." ]},
        { title: '💲 Gestión de precios', points: [ {bold: 'Precio base', text: 'Define monto particular e impuestos aplicables.'}, {bold: 'Propagación', text: 'Sincroniza cambios de precio hacia listas de referentes con un clic.'} ]}
    ];
    addHelpSection('🔬 Catálogo de Estudios', studyHelp);

    addAlert('Recordatorio crítico', 'Los parámetros y valores de referencia generados por la IA siempre deben revisarse por el director médico o responsable sanitario antes de activarse. Configura tus flujos de revisión interna para evitar publicar datos no validados.');
    
    const packageHelp = [
        { title: '📦 Construcción de paquetes', points: ["Agrupa estudios individuales o subpaquetes. El sistema garantiza que cada paquete mantenga paridad con los parámetros del estudio Perfil asociado.", {bold: 'Orden manual o drag & drop', text: 'Reordena componentes para reflejar el toque comercial o la secuencia de toma de muestras.'}]},
        { title: '🔁 Sincronización automática', points: ["Cuando se actualiza un Perfil, los paquetes derivados se regeneran y crean estudios faltantes para mantener consistencia."]},
        { title: '💲 Precios', points: ["Administra precio base, descuentos y promociones temporales enlazadas con Marketing."]}
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
        { title: '👥 Gestión de Usuarios', points: ["Crea cuentas con caducidad, fuerza MFA y asigna roles granularmente." ]},
        { title: '🔐 Roles y Permisos', points: ["Combina permisos predefinidos (captura, validación, finanzas) o crea tu matriz personalizada. Cada cambio queda auditado."]},
        { title: '🗒️ Auditoría Integral', points: ["Consulta el timeline de acciones (login, edición, publicación) para investigaciones internas." ]},
        { title: '⚙️ Configuración General', points: ["Define branding, plantillas de correo, zonas horarias y dominios de portal de resultados." ]},
        { title: '🏢 Sucursales y multitenancy', points: ["Activa nuevas sedes con catálogos compartidos o independientes y replica datos maestros en minutos." ]}
    ];
    addHelpSection('🛡️ Panel de Administración', adminHelp);
    
    addPageIfNecessary(400);

    const financeHelp = [
        { title: '📈 Dashboard de ingresos', points: ["Filtra por rango de fechas, sucursal, canal o paquete. Exporta a Excel o sincroniza con BI externo." ]},
        { title: '💳 Cuentas por cobrar y pagar', points: ["Registra abonos, aplica notas de crédito y configura recordatorios automáticos a clientes corporativos." ]},
        { title: '💸 Control de gastos', points: ["Clasifica egresos, adjunta comprobantes y concilia con bancos." ]},
        { title: '🧾 Facturación electrónica', points: ["Genera recibos timbrados o facturas proforma listos para SAT/DIAN (según jurisdicción)." ]},
        { title: '📊 Impuestos y tarifas', points: ["Define IVA/IGV/ITBIS y reglas por estudio o paquete." ]},
        { title: '🌊 Flujo de caja proyectado', points: ["Simula escenarios con base en cartera, gastos planificados y campañas activas." ]}
    ];
    addHelpSection('💵 Panel de Finanzas', financeHelp);
    
    addPageIfNecessary(400);

    const marketingHelp = [
        { title: '📢 Campañas omnicanal', points: ["Planea campañas con objetivos claros, asigna presupuesto y monitorea conversiones (órdenes generadas o leads captados)." ]},
        { title: '📱 Redes Sociales', points: ["Programa publicaciones, reutiliza plantillas de diseño y mide engagement desde el mismo panel." ]},
        { title: '📧 Email marketing', points: ["Segmenta pacientes por historial, automatiza recordatorios y monitorea aperturas/clics." ]},
        { title: '🌐 SEO & Contenido', points: ["Administra blog corporativo, audita palabras clave y genera briefs listos para copywriters." ]},
        { title: '⭐ Fidelización', points: ["Configura planes de puntos, referidos y beneficios VIP conectados al módulo de Finanzas." ]}
    ];
    addHelpSection('🎯 Marketing Digital Estratégico', marketingHelp);

    addFooter();
    return doc;
};