import React from 'react';
import { Users, TestTube as TestTubeDiagonal, Package, ClipboardList, ShieldCheck, DollarSign, Target, PenSquare, Search, Eye, Edit, Trash2, Tag as PriceTag, FileText, FileBarChart } from 'lucide-react';

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
    'Ver Lista (PDF)': FileText,
    'Reporte de Facturación': FileBarChart
};

const SectionTitle = ({ children, iconName }) => {
    const Icon = ICONS[iconName];
    return (
        <h2 className="text-2xl font-bold text-sky-700 dark:text-sky-400 mt-12 mb-6 border-b-2 border-sky-200 dark:border-sky-800 pb-2 flex items-center">
            {Icon && <Icon className="mr-3 h-7 w-7" />}
            {children}
        </h2>
    );
};

const SubSectionTitle = ({ children }) => (
    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8 mb-4">{children}</h3>
);

const Paragraph = ({ children, isQuote = false, className = '' }) => (
    <p className={`mb-4 text-slate-700 dark:text-slate-300 leading-relaxed ${isQuote ? 'pl-4 border-l-4 border-sky-500 italic bg-sky-50 dark:bg-sky-900/50 p-4 rounded-r-lg' : ''} ${className}`}>
        {children}
    </p>
);

const ListItem = ({ title, text, children }) => (
    <li className="mb-3 flex items-start">
        <span className="text-sky-500 mr-3 mt-1">&#9679;</span>
        <div>
            {title && <strong className="font-semibold text-slate-800 dark:text-slate-200">{title}:</strong>}
            {text && <span className="text-slate-600 dark:text-slate-400"> {text}</span>}
            {children}
        </div>
    </li>
);

const HelpSection = ({ mainTitle, content, children }) => (
    <div className="mb-10">
        <SectionTitle iconName={mainTitle}>{mainTitle}</SectionTitle>
        {children}
        {content && content.map((item, index) => (
            <div key={index} className="mb-6">
                <SubSectionTitle>{item.title}</SubSectionTitle>
                <ul className="list-none pl-2">
                    {item.points.map((point, pIndex) => (
                        typeof point === 'string'
                            ? <ListItem key={pIndex}><Paragraph className="mb-0">{point}</Paragraph></ListItem>
                            : <ListItem key={pIndex} title={point.bold} text={point.text} />
                    ))}
                </ul>
            </div>
        ))}
    </div>
);

const UserManualContent = React.forwardRef((props, ref) => {
    const patientHelp = [
        { title: '✍️ Añadir y Editar Pacientes', points: [ "Usa el botón \"Nuevo Paciente\" para registrar todos los datos del paciente.", {bold: "Guardar y Registrar Orden", text: "Guarda al paciente y te redirige inmediatamente para crear una nueva orden."} ]},
        { title: '🔍 Búsqueda y Filtros', points: ["Usa la barra de búsqueda para encontrar pacientes por nombre, email o teléfono."]},
        { title: '⚙️ Acciones en la Tabla', points: [ {bold: '👁️ Ver Historial', text: 'Accede al historial clínico completo.'}, {bold: '✏️ Editar', text: 'Modifica los datos del paciente.'}, {bold: '🗑️ Eliminar', text: 'Borra el registro del paciente (requiere confirmación).'} ]}
    ];

    const referrerHelp = [
        { title: '✍️ Añadir y Editar Referentes', points: [ "Usa \"Nuevo Referente\" para registrar médicos o instituciones. El referente 'Particular' es la base de precios y no puede ser editado.", ]},
        { title: '⚙️ Acciones en la Tabla', points: [ {bold: '✏️ Editar Datos', text: 'Modifica la información del referente.'}, {bold: '💲 Gestionar Precios', text: 'Crea listas de precios personalizadas.'}, {bold: '📄 Ver Lista (PDF)', text: 'Genera un PDF con la lista de precios.'}, {bold: '🗑️ Eliminar Referente', text: 'Borra permanentemente al referente.'} ]}
    ];
    
    const studyHelp = [
        { title: '🧪 Añadir y Editar Estudios', points: ["Usa \"Nuevo Estudio\" para definir nombres, categorías, parámetros y valores de referencia."]},
        { title: '🤖 Asistente de IA', points: ["\"Asistencia IA\" genera automáticamente la estructura de un estudio a partir de su nombre."]},
        { title: '💲 Gestión de Precios', points: [ {bold: 'Precio Base (Particular)', text: 'El precio definido en el formulario es el precio de lista.'}, {bold: 'Asignar Precios', text: 'Asigna precios diferentes a otros referentes usando el botón de la tabla.'} ]}
    ];
    
    const packageHelp = [
        { title: '📦 Crear y Editar Paquetes', points: ["Usa \"Nuevo Paquete\" para agrupar estudios individuales."]},
        { title: '💲 Gestión de Precios de Paquetes', points: ["El precio de un paquete se gestiona igual que un estudio: se establece un precio base y luego precios especiales por referente."]},
    ];
    
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

    const adminHelp = [
        { title: '👥 Gestión de Usuarios', points: ["Crea, edita y elimina cuentas de usuario y asigna roles."]},
        { title: '🔐 Roles y Permisos', points: ["Define roles personalizados con permisos específicos."]},
        { title: '🗒️ Auditoría del Sistema', points: ["Rastrea todas las acciones importantes para seguridad y control."]},
        { title: '⚙️ Configuración General', points: ["Configura datos de la empresa, reportes, e integraciones."]},
        { title: '🏢 Gestión de Sucursales', points: ["Administra múltiples sedes de forma centralizada."]}
    ];

    const financeHelp = [
        { title: '📈 Reporte de Ingresos', points: ["Analiza ingresos por fechas, estudios o referentes."]},
        { title: '💸 Control de Gastos', points: ["Registra y categoriza todos los gastos para optimizar costos."]},
        { title: '💰 Cuentas por Cobrar', points: ["Lleva un control de deudas y registra pagos."]},
        { title: '🧾 Facturación y Recibos', points: ["Genera recibos de pago y gestiona la facturación."]},
        { title: '📄 Reporte de Facturación', points: ["Genera reportes para instituciones, desglosando los estudios realizados por paciente en un período de tiempo para facilitar la facturación."]},
        { title: '📊 Configuración de Impuestos', points: ["Define los impuestos aplicables a tus servicios."]},
        { title: '🌊 Flujo de Caja', points: ["Monitorea en tiempo real las entradas y salidas de dinero."]}
    ];

    return (
        <div ref={ref} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-8 md:p-12 font-sans">
            <header className="text-center mb-12">
                <h1 className="text-5xl font-extrabold text-slate-900 dark:text-white mb-4">Bienvenido a LabSys</h1>
                <p className="text-xl text-slate-600 dark:text-slate-300">
                    La guía definitiva para transformar su laboratorio clínico.
                </p>
            </header>

            <main>
                <Paragraph isQuote={true}>
                    Este no es solo un manual; es el mapa para desbloquear todo el potencial de su negocio. LabSys ha sido diseñado desde cero para ir más allá de un simple sistema de gestión: es su socio estratégico para la eficiencia, el crecimiento y la excelencia.
                </Paragraph>

                <HelpSection mainTitle="Gestion de Pacientes" content={patientHelp} />
                <HelpSection mainTitle="Gestion de Referentes" content={referrerHelp} />
                <HelpSection mainTitle="Catálogo de Estudios" content={studyHelp} />
                <HelpSection mainTitle="Gestión de Paquetes" content={packageHelp} />
                <HelpSection mainTitle="Gestión de Órdenes" content={orderHelp} />
                <HelpSection mainTitle="Panel de Administración" content={adminHelp} />
                <HelpSection mainTitle="Panel de Finanzas" content={financeHelp} />
                
                <HelpSection mainTitle="Marketing Digital Estratégico">
                    <Paragraph>
                        Como profesional clínico, su mundo se basa en la precisión, los datos y los resultados reproducibles. El marketing digital no es diferente. Piense en este módulo como una extensión de su laboratorio: un lugar para experimentar, medir y optimizar la forma en que su laboratorio se comunica con el mundo para atraer más pacientes y fortalecer las relaciones con los médicos.
                    </Paragraph>
                    <Paragraph isQuote={true}>
                        <strong>El Flujo de Trabajo del Marketing Científico:</strong> Cada campaña es un experimento.
                        <br />
                        <strong>1. Hipótesis:</strong> ¿Qué queremos lograr y para quién? (Ej: "Creemos que una campaña en Facebook sobre perfiles prenatales aumentará las citas de mujeres embarazadas en un 15%").
                        <br />
                        <strong>2. Metodología:</strong> El diseño de la campaña (el anuncio, el email, la publicación).
                        <br />
                        <strong>3. Ejecución:</strong> Lanzar la campaña con las herramientas de LabSys.
                        <br />
                        <strong>4. Análisis de Resultados:</strong> Medir los KPIs (indicadores clave) para ver si la hipótesis fue correcta.
                    </Paragraph>

                    <SubSectionTitle>📢 Campañas de Publicidad</SubSectionTitle>
                    <Paragraph>
                        Aquí es donde invierte para llegar a nuevas audiencias. Es como usar un reactivo específico para obtener una reacción deseada.
                    </Paragraph>
                    <ul className="list-none pl-2">
                        <ListItem title="Paso 1: Estrategia (La Hipótesis)">
                            Defina su objetivo. ¿Quiere promocionar un nuevo estudio de alta especialidad entre médicos? ¿O una oferta de chequeo general para el público? Defina su público (demografía, intereses) y su presupuesto.
                        </ListItem>
                        <ListItem title="Paso 2: Creación (El Protocolo)">
                            Diseñe un anuncio claro y atractivo. Use imágenes de calidad y un mensaje directo que resalte el beneficio para el paciente o médico (Ej: "Resultados de Perfil Tiroideo en 24h. Precisión en la que puede confiar").
                        </ListItem>
                        <ListItem title="Paso 3: Gestión y Análisis (La Medición)">
                            Utilice la plataforma de anuncios (Facebook Ads, Google Ads) para lanzar su campaña. Luego, en LabSys, cruce los datos: ¿cuántas órdenes nuevas vinieron de pacientes que mencionaron la campaña? Mida el Retorno de Inversión (ROI).
                        </ListItem>
                    </ul>

                    <SubSectionTitle>📱 Gestión de Redes Sociales</SubSectionTitle>
                    <Paragraph>
                        Es su canal de comunicación constante con la comunidad. Piense en ello como la divulgación científica: educar, informar y generar confianza.
                    </Paragraph>
                     <ul className="list-none pl-2">
                        <ListItem title="Paso 1: Planificación de Contenido">
                            Cree un calendario. Lunes: "Mito vs. Realidad sobre el colesterol". Miércoles: "Conozca a nuestro equipo de Químicos". Viernes: "Promoción de fin de semana en perfiles de salud". El objetivo es aportar valor, no solo vender.
                        </ListItem>
                        <ListItem title="Paso 2: Creación y Programación">
                            Use las herramientas de LabSys para escribir y programar sus publicaciones. Cree gráficos sencillos con información útil (ej: qué significa tener la Vitamina D baja).
                        </ListItem>
                        <ListItem title="Paso 3: Publicación y Análisis">
                            Observe qué publicaciones generan más "me gusta", comentarios o son más compartidas. Esos son sus "controles positivos". Aprenda de ellos y replique el éxito.
                        </ListItem>
                    </ul>

                    <SubSectionTitle>📧 Email Marketing</SubSectionTitle>
                    <Paragraph>
                        Es la forma más directa de comunicarse con sus pacientes y médicos existentes. Es como enviar un recordatorio de seguimiento o un boletín de novedades científicas.
                    </Paragraph>
                    <ul className="list-none pl-2">
                        <ListItem title="Paso 1: Recopilación y Segmentación">
                            LabSys automáticamente construye su lista de correos. Segméntela: una lista para pacientes, otra para médicos. Puede incluso segmentar por tipo de estudio (pacientes diabéticos, cardiópatas, etc.).
                        </ListItem>
                        <ListItem title="Paso 2: Creación de Plantillas">
                            Diseñe correos profesionales. Use el Asistente de IA para generar contenido para un boletín mensual con consejos de salud, o para notificar a los médicos sobre un nuevo equipo o estudio disponible.
                        </ListItem>
                        <ListItem title="Paso 3: Envío y Análisis">
                            Envíe sus campañas y mida la tasa de apertura y de clics. ¿Qué titulares funcionan mejor? ¿Qué enlaces reciben más atención? Optimice basado en datos.
                        </ListItem>
                    </ul>
                </HelpSection>

            </main>
            <footer className="text-center mt-16 pt-8 border-t border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">&copy; {new Date().getFullYear()} LabSys. Todos los derechos reservados.</p>
            </footer>
        </div>
    );
});

export default UserManualContent;