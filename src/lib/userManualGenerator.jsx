import React from 'react';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { Users, TestTube as TestTubeDiagonal, Package, ClipboardList, ShieldCheck, DollarSign, Target, PenSquare, Search, Eye, Edit, Trash2, Tag as PriceTag, FileText } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';

const LINE_HEIGHT_RATIO = 1.35;
const P_SPACING = 12;

const ICONS = {
    'Gestion de Pacientes': Users,
    'Gestion de Referentes': Users,
    'Catálogo de Estudios': TestTubeDiagonal,
    'Gestión de Paquetes': Package,
    'Gestión de Órdenes': ClipboardList,
    'Panel de Administración': ShieldCheck,
    'Panel de Finanzas': DollarSign,
    'Marketing Digital Estratégico': Target,
    'Añadir y Editar': PenSquare,
    'Búsqueda y Filtros': Search,
    'Acciones en la Tabla': Edit,
    'Ver Historial': Eye,
    'Editar': Edit,
    'Eliminar': Trash2,
    'Gestionar Precios': PriceTag,
    'Ver Lista (PDF)': FileText
};

const getIconSvg = (IconComponent, options = {}) => {
  const { size = 12, color = '#1e293b' } = options;
  if (!IconComponent) return null;
  const iconElement = React.createElement(IconComponent, { size, color, strokeWidth: 2 });
  return ReactDOMServer.renderToString(iconElement);
};

class PDFBuilder {
    constructor() {
        this.y = 0;
        this.margin = 50;
    }

    async init() {
        this.doc = await PDFDocument.create();
        this.font = await this.doc.embedFont(StandardFonts.Helvetica);
        this.boldFont = await this.doc.embedFont(StandardFonts.HelveticaBold);
        this.italicFont = await this.doc.embedFont(StandardFonts.HelveticaOblique);
        this.addNewPage();
    }

    addNewPage() {
        this.page = this.doc.addPage();
        this.y = this.page.getHeight() - this.margin;
    }

    checkNewPage(requiredHeight) {
        if (this.y - requiredHeight < this.margin) {
            this.addFooter();
            this.addNewPage();
            return true;
        }
        return false;
    }

    getTextWidth(text, font, size) {
        return font.widthOfTextAtSize(text, size);
    }
    
    addFooter() {
        const pageNumber = this.doc.getPageCount();
        const footerText = `Página ${pageNumber}`;
        const footerHeight = 10;
        this.page.drawText(footerText, {
            x: this.page.getWidth() - this.margin - this.getTextWidth(footerText, this.font, 8),
            y: this.margin / 2,
            font: this.font,
            size: 8,
            color: rgb(0.5, 0.5, 0.5),
        });
    }

    async addTitle(text, options = {}) {
        const { size = 24, spaceBefore = 20, spaceAfter = 15 } = options;
        this.y -= spaceBefore;
        this.checkNewPage(size + spaceAfter);
        this.page.drawText(text, {
            x: this.margin,
            y: this.y,
            font: this.boldFont,
            size: size,
            color: rgb(15/255, 23/255, 42/255),
        });
        this.y -= (size + spaceAfter);
    }
    
    async addSubTitle(text, options = {}) {
        const { size = 16, spaceBefore = 10, spaceAfter = 10, iconName } = options;
        const iconSize = 18;
        this.y -= spaceBefore;
        this.checkNewPage(size + spaceAfter);

        let textX = this.margin;
        if(iconName && ICONS[iconName]){
            const svgPath = getIconSvg(ICONS[iconName], { size: iconSize, color: 'rgb(30, 64, 175)' });
            if(svgPath){
                this.page.drawSvg(svgPath, { x: this.margin, y: this.y - iconSize/2 + 1, color: rgb(30/255, 64/255, 175/255) });
                textX += iconSize + 8;
            }
        }
        
        this.page.drawText(text, {
            x: textX,
            y: this.y,
            font: this.boldFont,
            size: size,
            color: rgb(30/255, 64/255, 175/255),
        });
        this.y -= (size + spaceAfter);
    }
    
    async addParagraph(text, options = {}) {
        const { size = 10, isQuote = false, spaceAfter = P_SPACING } = options;
        const font = isQuote ? this.italicFont : this.font;
        const color = isQuote ? rgb(0.3, 0.3, 0.3) : rgb(71/255, 85/255, 105/255);
        const maxWidth = this.page.getWidth() - this.margin * 2;
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        for(const word of words) {
            const testLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
            if (this.getTextWidth(testLine, font, size) > maxWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);

        const requiredHeight = lines.length * size * LINE_HEIGHT_RATIO;
        this.checkNewPage(requiredHeight);
        
        if (isQuote) {
            this.page.drawRectangle({
                x: this.margin - 10,
                y: this.y - requiredHeight,
                width: this.page.getWidth() - this.margin * 2 + 20,
                height: requiredHeight + P_SPACING,
                color: rgb(241/255, 245/255, 249/255),
            });
        }
        
        for (const line of lines) {
            this.page.drawText(line, { x: this.margin, y: this.y, font, size, color });
            this.y -= size * LINE_HEIGHT_RATIO;
        }
        this.y -= spaceAfter;
    }
    
    async addListItem(title, text) {
        const iconSize = 10;
        const indent = 20;
        const titleSize = 10;
        const textSize = 10;
        const maxWidth = this.page.getWidth() - this.margin * 2 - indent;

        const titleText = `${title}:`;
        await this.addParagraph(titleText, { size: titleSize, spaceAfter: 2 });
        this.y += titleSize * LINE_HEIGHT_RATIO + 2;
        
        const textWords = text.split(' ');
        let textLines = [];
        let currentTextLine = '';

        for (const word of textWords) {
            const testLine = currentTextLine.length > 0 ? `${currentTextLine} ${word}` : word;
            if (this.getTextWidth(testLine, this.font, textSize) > maxWidth) {
                textLines.push(currentTextLine);
                currentTextLine = word;
            } else {
                currentTextLine = testLine;
            }
        }
        textLines.push(currentTextLine);
        const textHeight = textLines.length * textSize * LINE_HEIGHT_RATIO;
        
        this.checkNewPage(textHeight + P_SPACING);

        for (const line of textLines) {
            this.page.drawText(line, { x: this.margin + indent, y: this.y, font: this.font, size: textSize, color: rgb(71/255, 85/255, 105/255) });
            this.y -= textSize * LINE_HEIGHT_RATIO;
        }
        this.y -= P_SPACING;
    }

    async addSectionBreak() {
        this.y -= 10;
        this.checkNewPage(20);
        this.page.drawLine({
            start: { x: this.margin, y: this.y },
            end: { x: this.page.getWidth() - this.margin, y: this.y },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
        });
        this.y -= 20;
    }
    
    async addHelpSection(mainTitle, content) {
        await this.addSubTitle(mainTitle, { iconName: mainTitle });
        for (const item of content) {
            await this.addParagraph(item.title, { size: 12 });
            for (const point of item.points) {
                if(typeof point === 'string') {
                    await this.addParagraph(`• ${point}`, { indent: 15, spaceAfter: 5});
                } else {
                   await this.addListItem(point.bold, point.text);
                }
            }
        }
        await this.addSectionBreak();
    }
    
    async build() {
      this.addFooter();
      return await this.doc.save();
    }
}


export const generateUserManualPDF = async () => {
    const builder = new PDFBuilder();
    await builder.init();
    
    await builder.addTitle("Bienvenido a LabG40", { size: 28 });
    await builder.addParagraph("La guía definitiva para transformar su laboratorio clínico en un modelo de eficiencia, crecimiento y excelencia.");
    await builder.addParagraph("Este no es solo un manual; es el mapa para desbloquear todo el potencial de su negocio. LabG40 ha sido diseñado desde cero para ir más allá de un simple sistema de gestión: es su socio estratégico.", { isQuote: true });
    
    await builder.addSectionBreak();
    
    await builder.addTitle("Módulos Principales", {size: 20});

    const patientHelp = [
        { title: 'Añadir y Editar Pacientes', points: [ "Usa el botón \"Nuevo Paciente\" para registrar todos los datos del paciente.", {bold: "Guardar y Registrar Orden", text: "Guarda al paciente y te redirige inmediatamente para crear una nueva orden."} ]},
        { title: 'Búsqueda y Filtros', points: ["Usa la barra de búsqueda para encontrar pacientes por nombre, email o teléfono."]},
        { title: 'Acciones en la Tabla', points: [ {bold: 'Ver Historial', text: 'Accede al historial clínico completo.'}, {bold: 'Editar', text: 'Modifica los datos del paciente.'}, {bold: 'Eliminar', text: 'Borra el registro del paciente (requiere confirmación).'} ]}
    ];
    await builder.addHelpSection('Gestion de Pacientes', patientHelp);

    const referrerHelp = [
        { title: 'Añadir y Editar Referentes', points: [ "Usa \"Nuevo Referente\" para registrar médicos o instituciones. El referente 'Particular' es la base de precios y no puede ser editado.", ]},
        { title: 'Acciones en la Tabla', points: [ {bold: 'Editar Datos', text: 'Modifica la información del referente.'}, {bold: 'Gestionar Precios', text: 'Crea listas de precios personalizadas.'}, {bold: 'Ver Lista (PDF)', text: 'Genera un PDF con la lista de precios.'}, {bold: 'Eliminar Referente', text: 'Borra permanentemente al referente.'} ]}
    ];
    await builder.addHelpSection('Gestion de Referentes', referrerHelp);
    
    const studyHelp = [
        { title: 'Añadir y Editar Estudios', points: ["Usa \"Nuevo Estudio\" para definir nombres, categorías, parámetros y valores de referencia."]},
        { title: 'Asistente de IA', points: ["\"Asistencia IA\" genera automáticamente la estructura de un estudio a partir de su nombre."]},
        { title: 'Gestion de Precios', points: [ {bold: 'Precio Base (Particular)', text: 'El precio definido en el formulario es el precio de lista.'}, {bold: 'Asignar Precios', text: 'Asigna precios diferentes a otros referentes usando el botón de la tabla.'} ]}
    ];
    await builder.addHelpSection('Catálogo de Estudios', studyHelp);
    
    const packageHelp = [
        { title: 'Crear y Editar Paquetes', points: ["Usa \"Nuevo Paquete\" para agrupar estudios individuales."]},
        { title: 'Gestion de Precios de Paquetes', points: ["El precio de un paquete se gestiona igual que un estudio: se establece un precio base y luego precios especiales por referente."]},
    ];
    await builder.addHelpSection('Gestión de Paquetes', packageHelp);
    
    await builder.addTitle("El Ciclo de Vida de una Orden Perfecta", {size: 20});
    const orderHelp = [
        { title: 'Crear y Editar Órdenes', points: ["Usa \"Nueva Orden\" para registrar una solicitud."]},
        { title: 'Estados de la Orden', points: ["Pendiente ➡️ Procesando ➡️ Concluida ➡️ Reportada."]},
        { title: 'Acciones Principales', points: [
            {bold: 'Registrar Resultados', text: 'Captura los valores obtenidos en el laboratorio.'},
            {bold: 'Ver Comprobante', text: 'Genera un recibo de pago para el paciente.'},
            {bold: 'Hoja de Trabajo', text: 'Imprime una guía para el personal técnico.'},
            {bold: 'Imprimir Etiquetas', text: 'Genera etiquetas con códigos QR para las muestras.'},
            {bold: 'Ver Reporte Final', text: 'Visualiza e imprime el informe final de resultados.'},
            {bold: 'Asistente IA', text: 'Ofrece análisis y recomendaciones adicionales sobre los resultados.'},
        ]}
    ];
    await builder.addHelpSection('Gestión de Órdenes', orderHelp);

    await builder.addTitle("Paneles de Control: Su Torre de Mando", {size: 20});

    const adminHelp = [
        { title: 'Gestión de Usuarios', points: ["Crea, edita y elimina cuentas de usuario y asigna roles."]},
        { title: 'Roles y Permisos', points: ["Define roles personalizados con permisos específicos."]},
        { title: 'Auditoría del Sistema', points: ["Rastrea todas las acciones importantes para seguridad y control."]},
        { title: 'Configuración General', points: ["Configura datos de la empresa, reportes, e integraciones."]},
        { title: 'Plantillas y Reportes', points: ["Personaliza la apariencia de todos los documentos."]},
        { title: 'Gestión de Sucursales', points: ["Administra múltiples sedes de forma centralizada."]}
    ];
    await builder.addHelpSection('Panel de Administración', adminHelp);
    
    const financeHelp = [
        { title: 'Reporte de Ingresos', points: ["Analiza ingresos por fechas, estudios o referentes."]},
        { title: 'Control de Gastos', points: ["Registra y categoriza todos los gastos para optimizar costos."]},
        { title: 'Cuentas por Cobrar', points: ["Lleva un control de deudas y registra pagos."]},
        { title: 'Facturación y Recibos', points: ["Genera recibos de pago y gestiona la facturación."]},
        { title: 'Configuración de Impuestos', points: ["Define los impuestos aplicables a tus servicios."]},
        { title: 'Flujo de Caja', points: ["Monitorea en tiempo real las entradas y salidas de dinero."]}
    ];
    await builder.addHelpSection('Panel de Finanzas', financeHelp);
    
    const marketingHelp = [
        { title: 'Campañas de Publicidad', points: ["Flujo: Estrategia ➡️ Creación ➡️ Gestión y Análisis."]},
        { title: 'Gestión de Redes Sociales', points: ["Flujo: Planificación ➡️ Creación y Programación ➡️ Publicación y Análisis."]},
        { title: 'Email Marketing', points: ["Flujo: Recopilación y Segmentación ➡️ Creación ➡️ Envío y Análisis."]},
        { title: 'SEO y Contenido', points: ["Flujo: Investigación ➡️ Creación ➡️ Optimización y Monitoreo."]},
        { title: 'Programas de Lealtad', points: ["Flujo: Diseño ➡️ Implementación ➡️ Comunicación y Análisis."]}
    ];
    await builder.addHelpSection('Marketing Digital Estratégico', marketingHelp);

    return await builder.build();
};