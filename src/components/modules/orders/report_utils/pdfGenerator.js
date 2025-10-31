import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
    import { formatInTimeZone } from '@/lib/dateUtils';

    export const generatePdfContent = (
      order,
      patient,
      referrer,
      studiesDetails,
      packagesData,
      patientAgeData,
      labSettings,
      getReferenceRangeText,
      evaluateResult,
      cleanNumericValueForStorage,
      getStudiesAndParametersForOrder,
      compact = false,
      antibiogramPayload = null // { meta, rows }
    ) => {
      const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 10;
  const headerHeight = compact ? 58 : 85;
    const topHeaderOnly = compact ? 22 : 28; // margen superior en páginas 2+
      // Placeholder para total de páginas (se resuelve al final)
      const totalPagesExp = '{total_pages_count_string}';
      // Control para no dibujar la grilla de datos del paciente más de una vez por página
      const patientGridDrawnPages = new Set();

      const labInfo = labSettings.labInfo || {};
      const reportSettings = labSettings.reportSettings || {};
      const uiSettings = labSettings.uiSettings || {};

  const labName = labInfo.name || "Laboratorio Clínico";
      const fullAddress = [
        labInfo.calle,
        labInfo.numeroExterior,
        labInfo.numeroInterior ? `Int. ${labInfo.numeroInterior}` : null,
        labInfo.colonia,
        labInfo.ciudad,
        labInfo.estado,
        labInfo.codigoPostal ? `C.P. ${labInfo.codigoPostal}` : null,
        labInfo.pais
      ].filter(Boolean).join(', ');

      const labPhone = labInfo.phone;
      const labEmail = labInfo.email;
  const labLogo = uiSettings.logoUrl;
  const logoIncludesName = !!uiSettings.logoIncludesLabName; // if true, omit printing labName text to avoid duplication
      const dateFormat = reportSettings.dateFormat || 'dd/MM/yyyy';
      const timeFormat = reportSettings.timeFormat || 'HH:mm';
      const dateTimeFormat = `${dateFormat} ${timeFormat}`;

      let ageText = `${patientAgeData.ageYears} años`;
      if (patientAgeData.ageYears < 1) {
        ageText = `${patientAgeData.fullMonths} meses`;
        if (patientAgeData.fullMonths < 1) {
          ageText = `${patientAgeData.fullDays} días`;
        }
      }

      const patientInfoList = [
        { label: "Paciente:", value: patient.full_name },
        { label: "Folio Orden:", value: order.folio },
        { label: "F. Nacimiento:", value: formatInTimeZone(patient.date_of_birth, dateFormat) },
        { label: "Fecha Orden:", value: formatInTimeZone(order.order_date, dateTimeFormat) },
        { label: "Edad:", value: ageText },
        { label: "Sexo:", value: patient.sex },
      ];
      if (referrer) patientInfoList.push({ label: "Referente:", value: referrer.name });
      if (patient.phone_number) patientInfoList.push({ label: "Tel. Paciente:", value: patient.phone_number });
      if (patient.email) patientInfoList.push({ label: "Email Paciente:", value: patient.email });

  const patientInfoGrid = [];
      for (let i = 0; i < patientInfoList.length; i += 2) {
        const row = [
          patientInfoList[i].label,
          patientInfoList[i].value,
        ];
        if (patientInfoList[i + 1]) {
          row.push(patientInfoList[i + 1].label);
          row.push(patientInfoList[i + 1].value);
        }
        patientInfoGrid.push(row);
      }

      // Build studies to render with robust inference (same as preview):
      // 1) Prefer selected_items via getStudiesAndParametersForOrder
      // 2) If missing/empty, infer studies from order.results by studyId or parameterId mapping
      const computeStudiesToRender = () => {
        const fromSelected = (order.selected_items && order.selected_items.length && packagesData)
          ? getStudiesAndParametersForOrder(order.selected_items, studiesDetails, packagesData)
          : [];
        if (fromSelected && fromSelected.length) return fromSelected;

        const results = order.results || {};
        const studiesById = new Map((studiesDetails || []).map(s => [String(s.id), s]));
        const studyIdSet = new Set();
        const allKeys = Object.keys(results);
        // Direct study-id keys
        for (const k of allKeys) {
          if (studiesById.has(String(k))) studyIdSet.add(String(k));
        }
        // Parameter-id to study mapping
        const paramToStudyId = new Map();
        for (const s of (studiesDetails || [])) {
          for (const p of (s.parameters || [])) {
            paramToStudyId.set(String(p.id), String(s.id));
          }
        }
        const allEntries = allKeys.flatMap(k => Array.isArray(results[k]) ? results[k] : []);
        for (const r of allEntries) {
          const sid = paramToStudyId.get(String(r?.parametroId));
          if (sid && studiesById.has(sid)) studyIdSet.add(sid);
        }
        return Array.from(studyIdSet).map(id => studiesById.get(id)).filter(Boolean);
      };

      const studiesToRenderInPdf = computeStudiesToRender();

      // Detectar Biometría Hemática para layout especial en dos columnas
      const isCBCName = (name) => /biometr[ií]a hem[aá]tica/i.test(String(name || ''));
      let cbcStudy = null;
      // Filtra CBC, el resto se agrupará por paquete
      const nonCbcStudies = [];
      for (const s of studiesToRenderInPdf) {
        if (isCBCName(s?.name)) { cbcStudy = s; } else if (s) { nonCbcStudies.push(s); }
      }

      // Construimos grupos por paquete preservando el orden de selected_items
      const buildPackageGroups = () => {
        const groups = [];
        const seen = new Set();
        const studiesById = new Map((nonCbcStudies || []).map(s => [String(s.id), s]));
        const packagesById = new Map((packagesData || []).map(p => [String(p.id), p]));
        const pushGroup = (name, studyIds) => {
          const unique = [];
          for (const id of studyIds) {
            const key = String(id);
            if (studiesById.has(key) && !seen.has(key)) {
              unique.push(studiesById.get(key));
              seen.add(key);
            }
          }
          if (unique.length) groups.push({ name, studies: unique });
        };

        const items = Array.isArray(order?.selected_items) ? order.selected_items : [];
        for (const rawItem of items) {
          const item = { ...rawItem, id: rawItem.id || rawItem.item_id, type: (rawItem.type || rawItem.item_type) };
          if (!item.id || !item.type) continue;
          if (item.type === 'package') {
            const pack = packagesById.get(String(item.id));
            if (!pack || !Array.isArray(pack.items)) continue;
            const packStudyIds = pack.items.filter(x => (x.item_type === 'analysis' || x.item_type === 'study')).map(x => x.item_id);
            pushGroup(pack.name || 'Paquete', packStudyIds);
          } else if (item.type === 'analysis' || item.type === 'study') {
            const sid = String(item.id);
            if (studiesById.has(sid) && !seen.has(sid)) pushGroup('Estudios individuales', [sid]);
          }
        }

        // Agrega huérfanos que vengan de resultados o inferidos
        const orphans = [];
        for (const id of studiesById.keys()) {
          if (!seen.has(id)) orphans.push(id);
        }
        if (orphans.length) pushGroup('Estudios individuales', orphans);
        return groups;
      };

      const packageGroups = buildPackageGroups();

      // Construir el cuerpo con encabezados de paquete y (opcional) de estudio
      const mainContent = [];
      const norm = (s) => String(s || '').trim().toLowerCase();
      const shouldShowStudyHeader = (study) => {
        const params = Array.isArray(study.parameters) ? study.parameters : [];
        if (params.length !== 1) return true; // múltiples parámetros: siempre cabecera
        const single = params[0];
        // si el nombre coincide, omitimos cabecera de estudio
        return norm(study.name) !== norm(single.name);
      };

      // Helper para renderizar parámetros de un estudio al arreglo body
      const pushStudyParams = (studyDetail) => {
        const parameters = (studyDetail.parameters || []).map(p => ({
          ...p,
          valorReferencia: (p.valorReferencia || []).map(vr => ({
            ...vr,
            edadMin: cleanNumericValueForStorage(vr.edadMin),
            edadMax: cleanNumericValueForStorage(vr.edadMax),
            valorMin: cleanNumericValueForStorage(vr.valorMin),
            valorMax: cleanNumericValueForStorage(vr.valorMax),
            unidadEdad: vr.unidadEdad || 'años',
          }))
        }));

        // Prefer buckets por id de estudio; fallback buscar por parametroId
        let directResults = order.results?.[studyDetail.id] || order.results?.[String(studyDetail.id)] || [];
        const allResultKeys = Object.keys(order.results || {});
        if ((!directResults || directResults.length === 0) && allResultKeys.length > 0) {
          const flat = allResultKeys.flatMap(k => Array.isArray(order.results[k]) ? order.results[k] : []);
          const paramIdsSet = new Set(parameters.map(p => String(p.id)));
          const matched = flat.filter(r => paramIdsSet.has(String(r.parametroId)));
          if (matched.length) directResults = matched;
        }

        if (parameters.length > 0) {
          parameters.forEach(param => {
            const resultEntry = (Array.isArray(directResults) ? directResults : []).find(r => String(r.parametroId) === String(param.id));
            let resultValueToDisplay = "PENDIENTE";
            if (resultEntry && resultEntry.valor !== undefined && resultEntry.valor !== null && String(resultEntry.valor).trim() !== '') {
              resultValueToDisplay = String(resultEntry.valor);
            }
            const refData = getReferenceRangeText(param, patient, patientAgeData, true);
            const refRangeText = refData.valueText === 'N/A' ? 'N/A' : `${refData.valueText}\n${refData.demographics}`;
            mainContent.push([param.name, resultValueToDisplay, refRangeText, param]);
          });
        } else {
          mainContent.push([{ content: "Este estudio no tiene parámetros definidos.", colSpan: 3, styles: { fontStyle: 'italic', textColor: [100, 116, 139], halign: 'center', cellPadding: 3 } }]);
        }
      };

      // Construimos el body final
      for (const group of packageGroups) {
        // Encabezado de Paquete
        mainContent.push([{ content: group.name, colSpan: 3, styles: { fillColor: [226, 242, 253], textColor: [7, 89, 133], fontStyle: 'bold', fontSize: 11, cellPadding: 2.5 } }]);
        for (const study of group.studies) {
          if (shouldShowStudyHeader(study)) {
            mainContent.push([{ content: study.name, colSpan: 3, styles: { fillColor: [241, 245, 249], textColor: [14, 116, 144], fontStyle: 'bold', fontSize: 10.5, cellPadding: 2.0 } }]);
          }
          pushStudyParams(study);
        }
      }

      // Helper: render antibiogram section if provided
      const drawAntibiogramSection = (startY) => {
        const abg = antibiogramPayload;
        const has = !!(abg && Array.isArray(abg.rows) && abg.rows.length);
        if (!has) return startY;
        // Title
        autoTable(doc, {
          startY: startY,
          head: [['Antibiograma']],
          theme: 'grid',
          margin: { top: topHeaderOnly, left: margin, right: margin },
          tableWidth: pageWidth - 2 * margin,
          headStyles: { fillColor: [241, 245, 249], textColor: [14, 116, 144], fontStyle: 'bold', fontSize: compact ? 9 : 11, lineWidth: 0.1, lineColor: [203, 213, 225] },
          styles: { cellPadding: compact ? 1.5 : 2.0 },
          showHead: 'firstPage',
          didDrawPage: function(data) { drawHeaderAndFooter(data); },
        });
        let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 2 : startY + 2;
        // Meta line(s)
        const meta = abg.meta || {};
        const metaParts = [];
        if (meta.organism) metaParts.push(`Organismo: ${meta.organism}`);
        if (meta.specimen_type) metaParts.push(`Muestra: ${meta.specimen_type}`);
        if (meta.method) metaParts.push(`Método: ${meta.method}`);
        if (meta.standard) metaParts.push(`Estándar: ${meta.standard}${meta.standard_version ? (' ' + meta.standard_version) : ''}`);
        if (metaParts.length) {
          doc.setFontSize(compact ? 7 : 8).setFont(undefined, 'normal').setTextColor(51, 65, 85);
          const txt = metaParts.join('   ·   ');
          doc.text(txt, margin + 1, y);
          y += compact ? 4 : 5;
        }
        // Group rows by class
        const byClass = new Map();
        for (const r of (abg.rows || [])) {
          const key = r.antibiotic_class || '(Sin clase)';
          if (!byClass.has(key)) byClass.set(key, []);
          byClass.get(key).push(r);
        }
        for (const [cls, arr] of byClass.entries()) {
          // Class header band
          autoTable(doc, {
            startY: y,
            body: [[{ content: cls, styles: { fillColor: [226, 242, 253], textColor: [7, 89, 133], fontStyle: 'bold', fontSize: compact ? 7.5 : 9, halign: 'left', cellPadding: compact ? 1.2 : 1.6 } }]],
            theme: 'plain',
            margin: { top: topHeaderOnly, left: margin, right: margin },
            tableWidth: pageWidth - 2 * margin,
            styles: { cellPadding: 0.5 },
          });
          y = doc.lastAutoTable.finalY + 1;
          // Table for rows
          const body = arr.sort((a,b)=> String(a.antibiotic_name||'').localeCompare(String(b.antibiotic_name||''))).map(r => {
            const mt = r.measure_type || '';
            const v = (r.value_numeric ?? '') === '' || r.value_numeric == null ? '' : String(r.value_numeric);
            const u = r.unit || '';
            let measure = '—';
            if (mt && v && u) measure = `${mt}: ${v} ${u}`; else if (mt && v) measure = `${mt}: ${v}`; else if (v && u) measure = `${v} ${u}`; else measure = mt || v || u || '—';
            return [r.antibiotic_name || r.antibiotic_code || '', measure, r.interpretation || '—', r.comments || ''];
          });
          autoTable(doc, {
            startY: y,
            head: [['Antibiótico', 'Medida', 'S/I/R', 'Notas']],
            body,
            theme: 'grid',
            margin: { top: topHeaderOnly, left: margin, right: margin },
            tableWidth: pageWidth - 2 * margin,
            headStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
            styles: { fontSize: compact ? 7.0 : 8, cellPadding: compact ? 1.0 : 1.6, valign: 'middle', font: 'helvetica', overflow: 'linebreak' },
            columnStyles: { 0: { cellWidth: compact ? 60 : 70 }, 1: { cellWidth: compact ? 36 : 42, halign: 'center' }, 2: { cellWidth: compact ? 14 : 18, halign: 'center' }, 3: { cellWidth: 'auto' } },
            didDrawPage: function(data) { drawHeaderAndFooter(data); },
          });
          y = doc.lastAutoTable.finalY + 2;
        }
        return y;
      };

      // Helper: dibuja cabecera/paciente y pie de página
  const drawHeaderAndFooter = function (data) {
          // Header
          let yPos = compact ? 8 : 10;
          if (labLogo && reportSettings.showLogoInReport) {
            try {
              const img = new Image();
              img.src = labLogo;
              const aspectRatio = img.height > 0 ? (img.width / img.height) : 3.5; // fallback AR if metadata not ready
              const maxHeight = compact ? 10 : 12; // mm
              const maxWidth = (pageWidth - 2 * margin) * 0.5; // keep logo at up to 50% width
              let logoHeight = maxHeight;
              let logoWidth = logoHeight * aspectRatio;
              if (logoWidth > maxWidth) {
                logoWidth = maxWidth;
                logoHeight = logoWidth / aspectRatio;
              }
              // align logo left; allow center with optional flag
              const wantCenter = !!reportSettings.logoAlignCenter;
              const x = wantCenter ? (pageWidth - logoWidth) / 2 : margin;
              doc.addImage(img, 'PNG', x, yPos, logoWidth, logoHeight);
            } catch (e) { console.error("Error al cargar logo para PDF:", e); }
          }
          doc.setFontSize(compact ? 12 : 14).setFont(undefined, 'bold');
          doc.setTextColor(30, 58, 138); 
          if (!(labLogo && logoIncludesName)) {
            doc.text(labName, pageWidth / 2, yPos + 4, { align: 'center' });
          }
          yPos += compact ? 4 : 5;
          doc.setFontSize(compact ? 7 : 8).setFont(undefined, 'normal');
          doc.setTextColor(100, 116, 139);
          if (fullAddress) {
            doc.text(fullAddress, pageWidth / 2, yPos + 4, { align: 'center' });
            yPos += compact ? 3 : 4;
          }
          let contactString = [];
          if (labPhone) contactString.push(`Tel: ${labPhone}`);
          if (labEmail) contactString.push(`Email: ${labEmail}`);
          if (contactString.length > 0) {
            doc.text(contactString.join(' | '), pageWidth / 2, yPos + 4, { align: 'center' });
          }
          yPos += compact ? 8 : 10;
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += compact ? 6 : 8;
          doc.setFontSize(compact ? 11 : 12).setFont(undefined, 'bold');
          doc.setTextColor(51, 65, 85);
          // Para CBC, omitimos el título grande en el encabezado (fue comentado como "está de más").
          const reportTitle = cbcStudy ? '' : (reportSettings.defaultHeader || 'Reporte de Resultados');
          if (reportTitle) {
            const titleWidth = doc.getStringUnitWidth(reportTitle) * doc.internal.getFontSize() / doc.internal.scaleFactor;
            const titleX = (pageWidth - titleWidth) / 2;
            doc.text(reportTitle, titleX, yPos);
            yPos += compact ? 6 : 8;
          }
          // Dibuja datos del paciente solo en la primera página y una sola vez
          if (data.pageNumber === 1 && !patientGridDrawnPages.has(1)) {
            autoTable(doc, {
              startY: yPos,
              body: patientInfoGrid,
              theme: 'plain',
              styles: { fontSize: compact ? 7.2 : 8.5, cellPadding: compact ? 0.4 : 0.8, overflow: 'linebreak' },
              columnStyles: { 0: { fontStyle: 'bold', textColor: [51, 65, 85] }, 2: { fontStyle: 'bold', textColor: [51, 65, 85] } },
            });
            patientGridDrawnPages.add(1);
          }

          // Footer
          doc.setFontSize(compact ? 7 : 8).setFont(undefined, 'italic');
          doc.setTextColor(100, 116, 139);
          // VN note (Valores Normales)
          doc.setFontSize(compact ? 6.5 : 7).setFont(undefined, 'normal');
          doc.text('VN = Valores Normales', margin, pageHeight - 13, { align: 'left' });
          // Main footer
          const footerText = reportSettings.defaultFooter || 'Gracias por su preferencia. Los resultados deben ser interpretados por un médico.';
          doc.setFontSize(compact ? 7 : 8).setFont(undefined, 'italic');
          doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
          // Nota al pie: VN = Valores Normales
          doc.text('VN = Valores Normales', margin, pageHeight - 10, { align: 'left' });
          doc.text(`Página ${data.pageNumber} de ${totalPagesExp}`, pageWidth - margin, pageHeight - 10, { align: 'right' });

          // Firmas y notas (última página, se maneja al final del documento)
      };

      // Si hay Biometría Hemática, dibujarla primero en dos columnas
      let afterCbcY = headerHeight;
      if (cbcStudy) {
        const gutter = 6;
        const colWidth = (pageWidth - 2 * margin - gutter);
        const leftWidth = colWidth / 2;
        const rightWidth = colWidth / 2;
        // Título del estudio (Biometría Hemática)
        autoTable(doc, {
          startY: headerHeight,
          head: [[cbcStudy.name || 'Biometría Hemática']],
          theme: 'grid',
          margin: { top: topHeaderOnly, left: margin, right: margin },
          tableWidth: pageWidth - 2 * margin,
          headStyles: { fillColor: [241, 245, 249], textColor: [14, 116, 144], fontStyle: 'bold', fontSize: 11, lineWidth: 0.1, lineColor: [203, 213, 225] },
          styles: { cellPadding: compact ? 2.0 : 2.5 },
          showHead: 'firstPage',
          didDrawPage: function(data) { drawHeaderAndFooter(data); },
        });
        const startY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 2 : headerHeight;

        // Utilidades de agrupación (mismas reglas que preview)
        const groupParams = (parameters = []) => {
          const list = parameters || [];
          const findAny = (arr) => list.filter(p => arr.some(k => (p.name || '').toLowerCase().includes(k)));
          const rojaOrder = ['Hemoglobina','Hematocrito','Eritrocitos','Volumen globular Medio','VCM','Hemoglobina glob. med.','HCM','Conc. media de Hb glob.','CHCM','RDW','Reticulocitos'];
          const roja = [];
          const consumed = new Set();
          rojaOrder.forEach(n => { const hit = list.find(p => (p.name || '').toLowerCase() === n.toLowerCase()); if (hit) { roja.push(hit); consumed.add(hit.id || hit.name); } });
          const plaquetaria = [];
          const plateCandidates = findAny(['plaquet','vmp','mpv']);
          plateCandidates.forEach(p => { const key = p.id || p.name; if (!consumed.has(key)) { plaquetaria.push(p); consumed.add(key); } });
          const blanca = [];
          const blancaKeys = ['leucocitos','neutrófilos','neutrofilos','segmentados','banda','metamielocitos','mielocitos','promielocitos','blastos','eosinófilos','eosinofilos','basófilos','basofilos','monocitos','linfocitos'];
          const whiteCandidates = findAny(blancaKeys);
          whiteCandidates.forEach(p => { const key = p.id || p.name; if (!consumed.has(key)) { blanca.push(p); consumed.add(key); } });
          const otros = list.filter(p => !consumed.has(p.id || p.name)).map(p => ({ ...p, __otros: true }));
          if (otros.length) blanca.push(...otros);
          return { roja, plaquetaria, blanca };
        };

        const fillRows = (rows) => rows.map(p => {
          const resultEntry = (Array.isArray(order.results?.[cbcStudy.id]) ? order.results[cbcStudy.id] : []).find(r => String(r.parametroId) === String(p.id))
            || Object.values(order.results || {}).flatMap(v => Array.isArray(v) ? v : []).find(r => String(r.parametroId) === String(p.id));
          const value = resultEntry && resultEntry.valor !== undefined && resultEntry.valor !== null && String(resultEntry.valor).trim() !== '' ? String(resultEntry.valor) : 'PENDIENTE';
          // Rango de referencia compacto por debajo
          const refData = getReferenceRangeText ? getReferenceRangeText(p, patient, patientAgeData, true) : null;
          const refText = refData && refData.valueText !== 'N/A' ? `${refData.valueText}${refData.demographics ? ' · ' + refData.demographics : ''}` : '';
          // Nueva columna de Unidades separada
          const unit = p.unit || '';
          return [p.name, value, unit, refText, p];
        });

        const { roja, plaquetaria, blanca } = groupParams(cbcStudy.parameters || []);

        const drawColumnSections = (x, width, sections) => {
          let y = startY;
          sections.forEach(sec => {
            const bodyRows = fillRows(sec.rows);
            autoTable(doc, {
              startY: y,
              margin: { top: topHeaderOnly, left: x, right: margin },
              tableWidth: width,
              head: [[sec.title, 'Resultado', 'Unidades', 'Valores de Referencia (VN)']],
              body: bodyRows,
              theme: 'grid',
              headStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
              styles: { fontSize: compact ? 7.2 : 8, cellPadding: compact ? 0.9 : 1.4, valign: 'middle', font: 'helvetica', overflow: 'linebreak' },
              // Columnas: Parámetro 40%, Resultado 20%, Unidades 12%, Referencia 28%
              columnStyles: { 0: { cellWidth: width * 0.40, fontStyle: 'bold' }, 1: { cellWidth: width * 0.20, halign: 'center' }, 2: { cellWidth: width * 0.12, halign: 'center' }, 3: { cellWidth: width * 0.28, halign: 'center' } },
              didParseCell: (data) => {
                // Sombrear columna de Rango Normal
                if (data.column.index === 3) {
                  data.cell.styles.fillColor = [229, 231, 235];
                }
                if (data.cell.section === 'body' && data.column.index === 1) {
                  const param = data.row.raw[4];
                  const value = data.cell.text[0];
                  const status = evaluateResult(String(value), param, patient, patientAgeData);
                  data.cell.styles.fontStyle = 'bold';
                  switch (status) {
                    case 'bajo': data.cell.styles.textColor = [59, 130, 246]; break;
                    case 'alto': data.cell.styles.textColor = [249, 115, 22]; break;
                    case 'normal':
                    case 'valido-alfanumerico': data.cell.styles.textColor = [22, 101, 52]; break;
                    default: data.cell.styles.fontStyle = 'normal'; data.cell.styles.textColor = [100, 116, 139];
                  }
                }
              },
              didDrawCell: (data) => {
                // Dibujar flechas arriba/abajo en fuera de rango para columna Resultado
                if (data.cell.section === 'body' && data.column.index === 1) {
                  const param = data.row.raw[4];
                  if (!param || !data.cell.text) return;
                  const value = data.cell.text[0];
                  if (typeof value === 'undefined' || value === null) return;
                  const status = evaluateResult(String(value), param, patient, patientAgeData);
                  if (status === 'bajo' || status === 'alto') {
                    const cell = data.cell;
                    const textWidth = doc.getStringUnitWidth(String(value)) * cell.styles.fontSize / doc.internal.scaleFactor;
                    const textX = cell.x + (cell.width - textWidth) / 2;
                    const arrowSize = 1.5;
                    const arrowX = textX - arrowSize - 1;
                    const arrowY = cell.y + cell.height / 2;
                    doc.setLineWidth(0.2);
                    if (status === 'bajo') {
                      doc.setDrawColor(59, 130, 246);
                      doc.setFillColor(59, 130, 246);
                      doc.triangle(arrowX, arrowY - arrowSize/2, arrowX + arrowSize, arrowY - arrowSize/2, arrowX + arrowSize/2, arrowY + arrowSize/2, 'F');
                    } else { // alto
                      doc.setDrawColor(249, 115, 22);
                      doc.setFillColor(249, 115, 22);
                      doc.triangle(arrowX, arrowY + arrowSize/2, arrowX + arrowSize, arrowY + arrowSize/2, arrowX + arrowSize/2, arrowY - arrowSize/2, 'F');
                    }
                  }
                }
              }
            });
            y = doc.lastAutoTable.finalY + 4;
          });
          return y;
        };

        const leftEndY = drawColumnSections(margin, leftWidth, [
          { title: 'Serie Roja', rows: roja },
          { title: 'Serie Plaquetaria', rows: plaquetaria }
        ]);
        const rightStartX = margin + leftWidth + gutter;
        // Serie Blanca: dos columnas (Absoluto y %). Para simplificar: duplicamos filas,
        // separando las que parecen % de las que no (
  const whiteAbs = blanca.filter(p => !String(p.unit || '').includes('%'));
  const whitePct = blanca.filter(p => String(p.unit || '').includes('%'));

        // Construimos cuerpo manual con 3 columnas: Parámetro | Absoluto | % (más referencia aparte)
  const buildWhiteBody = () => {
          // Helpers
          const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const toNum = (val) => {
            const s = (cleanNumericValueForStorage ? cleanNumericValueForStorage(val) : val);
            const n = parseFloat(String(s).replace(',', '.'));
            return Number.isFinite(n) ? n : null;
          };
          const fmtAbs = (n) => (n === null || typeof n === 'undefined') ? '—' : String(Number(n.toFixed(1)));
          const fmtPct = (n) => (n === null || typeof n === 'undefined') ? '—' : String(Math.round(n));

          // Busca Leucocitos Totales en la lista blanca y obtiene su valor
          const isTotalLeuk = (name) => {
            const t = norm(name);
            return (t.includes('leucocitos') && t.includes('total')) || t.includes('wbc');
          };
          const totalLeukParam = blanca.find(p => isTotalLeuk(p?.name || '')) || whiteAbs.find(p => isTotalLeuk(p?.name || ''));
          const getVal = (param) => {
            if (!param) return '—';
            const resultEntry = (Array.isArray(order.results?.[cbcStudy.id]) ? order.results[cbcStudy.id] : []).find(r => String(r.parametroId) === String(param.id))
              || Object.values(order.results || {}).flatMap(v => Array.isArray(v) ? v : []).find(r => String(r.parametroId) === String(param.id));
            return resultEntry && resultEntry.valor !== undefined && resultEntry.valor !== null && String(resultEntry.valor).trim() !== '' ? String(resultEntry.valor) : 'PENDIENTE';
          };
          const totalLeukValRaw = totalLeukParam ? getVal(totalLeukParam) : null;
          const totalLeuk = toNum(totalLeukValRaw);

          const mapByName = (arr) => new Map(arr.map(p => [String(p.name).toLowerCase(), p]));
          const absMap = mapByName(whiteAbs);
          const pctMap = mapByName(whitePct);
          const names = Array.from(new Set([...absMap.keys(), ...pctMap.keys()]));
          const rows = names.map(nameKey => {
            const pAbs = absMap.get(nameKey);
            const pPct = pctMap.get(nameKey);
            const pRef = pAbs || pPct; // para unidad/ref

            // Valores base
            const absRaw = getVal(pAbs);
            const pctRaw = getVal(pPct);
            const absNum = toNum(absRaw);
            const pctNum = toNum(pctRaw);

            // Derivaciones a partir de leucocitos totales
            let absOut = absRaw;
            let pctOut = pctRaw;
            const isTotalThisRow = pRef && isTotalLeuk(pRef.name || '');
            if (!isTotalThisRow && totalLeuk !== null) {
              if ((absNum === null || absRaw === 'PENDIENTE' || absRaw === '—') && pctNum !== null) {
                absOut = fmtAbs(totalLeuk * (pctNum / 100));
              }
              if ((pctNum === null || pctRaw === 'PENDIENTE' || pctRaw === '—') && absNum !== null && totalLeuk > 0) {
                pctOut = fmtPct((absNum / totalLeuk) * 100);
              }
            }

            const refData = getReferenceRangeText ? getReferenceRangeText(pRef, patient, patientAgeData, true) : null;
            const refText = refData && refData.valueText !== 'N/A' ? `${refData.valueText}${refData.demographics ? ' · ' + refData.demographics : ''}` : '';
            const refIsPercent = !!(refData && typeof refData.valueText === 'string' && refData.valueText.includes('%'));

            // Sin unidades: removemos líneas de unidad y mostramos solo valores
            return [pRef?.name || nameKey, absOut, pctOut, /*ref*/ refText, /*pAbs*/ pAbs || null, /*pPct*/ pPct || null, /*refIsPercent*/ refIsPercent];
          });
          // Mover "Otros" al final si existe una fila con ese nombre
          const otrosIndex = rows.findIndex(r => norm(r[0]) === 'otros');
          if (otrosIndex > -1) {
            const [otrosRow] = rows.splice(otrosIndex, 1);
            rows.push(otrosRow);
          }
          return rows;
        };

        // Dibuja Serie Blanca manualmente
        autoTable(doc, {
          startY: startY,
          margin: { top: topHeaderOnly, left: rightStartX, right: margin },
          tableWidth: rightWidth,
          head: [[ 'Serie Blanca', '', '' ]],
          theme: 'grid',
          headStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
          styles: { fontSize: compact ? 7.2 : 8, cellPadding: compact ? 0.9 : 1.4, valign: 'middle', font: 'helvetica' },
          body: [],
          columnStyles: { 0: { cellWidth: rightWidth * 0.44, fontStyle: 'bold' }, 1: { cellWidth: rightWidth * 0.22, halign: 'center' }, 2: { cellWidth: rightWidth * 0.34, halign: 'center' } },
        });
        const whiteHeaderY = doc.lastAutoTable.finalY;
        // Banda superior con dos mitades: izquierda (Leucocitos totales + valor), derecha (Rango Normal (Abs.) + texto)
        const normText = (p) => {
          const ref = getReferenceRangeText ? getReferenceRangeText(p, patient, patientAgeData, true) : null;
          return ref && ref.valueText !== 'N/A' ? `${ref.valueText} /µL` : '';
        };
        const normName = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const isTotalLeuk = (name) => {
          const t = normName(name);
          return (t.includes('leucocitos') && t.includes('total')) || t.includes('wbc');
        };
        const totalLeukParam = (cbcStudy.parameters || []).find(p => isTotalLeuk(p?.name || ''));
        const totalLeukRes = (()=>{
          if (!totalLeukParam) return '—';
          const list = Array.isArray(order.results?.[cbcStudy.id]) ? order.results[cbcStudy.id] : [];
          const hit = list.find(r => String(r.parametroId) === String(totalLeukParam.id))
            || Object.values(order.results || {}).flatMap(v => Array.isArray(v) ? v : []).find(r => String(r.parametroId) === String(totalLeukParam.id));
          return (hit && hit.valor !== undefined && hit.valor !== null && String(hit.valor).trim() !== '') ? String(hit.valor) : '—';
        })();
        const totalLeukRange = totalLeukParam ? normText(totalLeukParam) : '';
        // Texto: 'Leucocitos totales' (izquierda), valor (centro), 'Rango Normal (Abs.)' + rango (derecha)
    const bandY = whiteHeaderY + (compact ? 4 : 5);
  const bandH = compact ? 8.5 : 9.5;
  const leftW = rightWidth * 0.60;
  const rightW = rightWidth - leftW;
  // Marco de banda
  doc.setDrawColor(203, 213, 225);
  doc.rect(rightStartX, bandY - (bandH - 2), rightWidth, bandH, 'S');
  // Mitad derecha sombreada
  doc.setFillColor(241, 245, 249); // más claro para mejor contraste
  doc.rect(rightStartX + leftW, bandY - (bandH - 2), rightW, bandH, 'F');
  // Textos
  doc.setFontSize(compact ? 7.3 : 8.1).setFont(undefined, 'bold').setTextColor(51, 65, 85);
  doc.text('Leucocitos totales', rightStartX + 2, bandY);
  doc.setFontSize(compact ? 9.2 : 10.2).setFont(undefined, 'bold').setTextColor(0, 0, 0);
  doc.text(String(totalLeukRes), rightStartX + (leftW / 2), bandY, { align: 'center' });
  doc.setFontSize(compact ? 7.3 : 8.1).setFont(undefined, 'bold').setTextColor(30, 41, 59);
  const rnLabel = 'Rango Normal (Abs.)';
  const rnText = totalLeukRange ? `${rnLabel}  ${totalLeukRange}` : rnLabel;
  doc.text(rnText, rightStartX + rightWidth - 2, bandY, { align: 'right' });
        autoTable(doc, {
          startY: bandY + 4,
          margin: { top: topHeaderOnly, left: rightStartX, right: margin },
          tableWidth: rightWidth,
          // Encabezado verde, columnas: Parámetro | Absoluto | % | Valores de Referencia (Abs.)
          head: [[ 'Parámetro', 'Absoluto', '%', 'Valores de Referencia (VN)' ]],
          body: (function(){
            const rows = buildWhiteBody();
            // Mantener datos ocultos para evaluación precisa:
            // [name, abs, pct, rangoVisible, pAbs, pPct, refIsPercent]
            return rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]);
          })(),
          theme: 'grid',
          headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
          styles: { fontSize: compact ? 7.2 : 8, cellPadding: compact ? 0.9 : 1.4, valign: 'middle', font: 'helvetica', overflow: 'linebreak' },
              // Columnas consistentes: Param 44%, Abs 22%, % 12%, Ref 22%
          columnStyles: { 0: { cellWidth: rightWidth * 0.44, fontStyle: 'bold' }, 1: { cellWidth: rightWidth * 0.22, halign: 'center' }, 2: { cellWidth: rightWidth * 0.12, halign: 'center' }, 3: { cellWidth: rightWidth * 0.22, halign: 'center' } },
          didParseCell: (data) => {
            // sombrear columna de rango normal y asegurar legibilidad (texto oscuro)
            if (data.column.index === 3) {
              data.cell.styles.fillColor = [241, 245, 249];
              data.cell.styles.textColor = [30, 41, 59];
              data.cell.styles.fontStyle = 'normal';
            }
            if (data.cell.section === 'body' && (data.column.index === 1 || data.column.index === 2)) {
              const pAbs = data.row.raw[4];
              const pPct = data.row.raw[5];
              const refIsPercent = !!data.row.raw[6];
              const col = data.column.index; // 1: Abs, 2: %
              // Solo coloreamos la columna relevante según el tipo de referencia
              const isRelevant = (refIsPercent && col === 2) || (!refIsPercent && col === 1);
              const value = data.cell.text && data.cell.text[0];
              if (!isRelevant) {
                // Dejar en neutro si no es la columna prioritaria
                data.cell.styles.fontStyle = 'normal';
                data.cell.styles.textColor = [100, 116, 139];
                return;
              }
              const param = col === 2 ? (pPct || pAbs) : (pAbs || pPct);
              const status = evaluateResult(String(value), param, patient, patientAgeData);
              data.cell.styles.fontStyle = 'bold';
              switch (status) {
                case 'bajo': data.cell.styles.textColor = [59, 130, 246]; break;
                case 'alto': data.cell.styles.textColor = [249, 115, 22]; break;
                case 'normal':
                case 'valido-alfanumerico': data.cell.styles.textColor = [22, 101, 52]; break;
                default: data.cell.styles.fontStyle = 'normal'; data.cell.styles.textColor = [100, 116, 139];
              }
            }
          },
          didDrawCell: (data) => {
            // Flechas de fuera de rango en la columna prioritaria (según referencia)
            if (data.cell.section === 'body' && (data.column.index === 1 || data.column.index === 2)) {
              const pAbs = data.row.raw[4];
              const pPct = data.row.raw[5];
              const refIsPercent = !!data.row.raw[6];
              const col = data.column.index;
              const isRelevant = (refIsPercent && col === 2) || (!refIsPercent && col === 1);
              if (!isRelevant) return;
              const value = data.cell.text && data.cell.text[0];
              const param = col === 2 ? (pPct || pAbs) : (pAbs || pPct);
              if (typeof value === 'undefined' || value === null) return;
              const status = evaluateResult(String(value), param, patient, patientAgeData);
              if (status === 'bajo' || status === 'alto') {
                const cell = data.cell;
                const textWidth = doc.getStringUnitWidth(String(value)) * cell.styles.fontSize / doc.internal.scaleFactor;
                const textX = cell.x + (cell.width - textWidth) / 2;
                const arrowSize = 1.5;
                const arrowX = textX - arrowSize - 1;
                const arrowY = cell.y + cell.height / 2;
                doc.setLineWidth(0.2);
                if (status === 'bajo') {
                  doc.setDrawColor(59, 130, 246);
                  doc.setFillColor(59, 130, 246);
                  doc.triangle(arrowX, arrowY - arrowSize/2, arrowX + arrowSize, arrowY - arrowSize/2, arrowX + arrowSize/2, arrowY + arrowSize/2, 'F');
                } else {
                  doc.setDrawColor(249, 115, 22);
                  doc.setFillColor(249, 115, 22);
                  doc.triangle(arrowX, arrowY + arrowSize/2, arrowX + arrowSize, arrowY + arrowSize/2, arrowX + arrowSize/2, arrowY - arrowSize/2, 'F');
                }
              }
            }
          }
        });
        const rightEndY = doc.lastAutoTable.finalY + 4;
        afterCbcY = Math.max(leftEndY, rightEndY) + 6;
      }

  if (mainContent.length > 0) {
  autoTable(doc, {
        theme: 'grid',
    head: [['Parámetro', 'Resultado', 'Valores de Referencia (VN)']],
        body: mainContent,
        startY: cbcStudy ? afterCbcY : headerHeight,
    margin: { top: topHeaderOnly, left: margin, right: margin },
        showHead: 'firstPage',
        headStyles: { 
            fillColor: [248, 250, 252], 
            textColor: [30, 41, 59],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [203, 213, 225], 
        },
        styles: { fontSize: compact ? 7.0 : 8, cellPadding: compact ? 1.0 : 1.8, valign: 'middle', font: 'helvetica' },
        columnStyles: {
          // Reducimos 'Parámetro' y ampliamos 'Valores de Referencia'
          0: { cellWidth: compact ? 42 : 46, fontStyle: 'bold' },
          1: { cellWidth: compact ? 28 : 34, halign: 'center' },
          2: { cellWidth: 'auto', fontSize: compact ? 7 : 7.5 },
        },
        didDrawCell: (data) => {
          if (data.column.index === 1 && data.cell.section === 'body') {
            const param = data.row.raw[3];
            if (!param || !data.cell.text) return;
            const value = data.cell.text[0];
            if (typeof value === 'undefined' || value === null) return;
            
            const status = evaluateResult(String(value), param, patient, patientAgeData);
            
            const cell = data.cell;
            const textWidth = doc.getStringUnitWidth(String(value)) * cell.styles.fontSize / doc.internal.scaleFactor;
            const textX = cell.x + (cell.width - textWidth) / 2;
            
            if (status === 'bajo' || status === 'alto') {
              const arrowSize = 1.5;
              const arrowX = textX - arrowSize - 1;
              const arrowY = cell.y + cell.height / 2;
              
              doc.setLineWidth(0.2);
              if (status === 'bajo') {
                doc.setDrawColor(59, 130, 246);
                doc.setFillColor(59, 130, 246);
                doc.triangle(arrowX, arrowY - arrowSize/2, arrowX + arrowSize, arrowY - arrowSize/2, arrowX + arrowSize/2, arrowY + arrowSize/2, 'F');
              } else { // alto
                doc.setDrawColor(249, 115, 22);
                doc.setFillColor(249, 115, 22);
                doc.triangle(arrowX, arrowY + arrowSize/2, arrowX + arrowSize, arrowY + arrowSize/2, arrowX + arrowSize/2, arrowY - arrowSize/2, 'F');
              }
            }
          }
        },
    didParseCell: (data) => {
          if (data.cell.section === 'body') {
        const param = data.row.raw[3];
              if (!param) {
          data.row.cells[0].colSpan = 3;
                  return;
              }
              const value = data.cell.text[0];
              const status = evaluateResult(String(value), param, patient, patientAgeData);

              data.cell.styles.fontStyle = 'bold';
              if (data.column.index === 1) {
                switch (status) {
                  case 'bajo':
                    data.cell.styles.textColor = [59, 130, 246]; 
                    break;
                  case 'alto':
                    data.cell.styles.textColor = [249, 115, 22]; 
                    break;
                  case 'normal':
                  case 'valido-alfanumerico':
                    data.cell.styles.textColor = [22, 101, 52]; 
                    break;
                  default:
                    data.cell.styles.fontStyle = 'normal';
                    data.cell.styles.textColor = [100, 116, 139]; 
                    break;
                }
              }
          }
        },
        didDrawPage: function (data) {
          drawHeaderAndFooter(data);

          if (data.pageNumber === doc.internal.getNumberOfPages()) {
                let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : undefined;
                // Antibiogram section (draw after main table if exists)
                finalY = drawAntibiogramSection((typeof finalY === 'number' ? finalY + 6 : headerHeight));
            if (order.validation_notes) {
                doc.setFontSize(9).setFont(undefined, 'bold');
                doc.text("Notas de Validación / Observaciones:", margin, finalY + 8);
                doc.setFontSize(8).setFont(undefined, 'normal');
                const splitNotes = doc.splitTextToSize(order.validation_notes, pageWidth - (2 * margin));
                doc.text(splitNotes, margin, finalY + 12);
            }

            const responsableNombre = labInfo.responsableSanitarioNombre;
            const responsableCedula = labInfo.responsableSanitarioCedula;
            if (responsableNombre) {
                let signatureY = pageHeight - 30;
                if (finalY > signatureY - 20) {
                  signatureY = finalY + 20;
                  if(signatureY > pageHeight -30) {
                    doc.addPage();
                    signatureY = 30;
                  }
                }
                doc.setDrawColor(100, 116, 139);
                doc.line(pageWidth / 2 - 30, signatureY, pageWidth / 2 + 30, signatureY);
                doc.setFontSize(8).setFont(undefined, 'bold');
                doc.text("Responsable Sanitario", pageWidth / 2, signatureY + 4, { align: 'center' });
                doc.setFontSize(8).setFont(undefined, 'normal');
                doc.text(responsableNombre, pageWidth / 2, signatureY + 8, { align: 'center' });
                if (responsableCedula) {
                    doc.text(`Céd. Prof. ${responsableCedula}`, pageWidth / 2, signatureY + 12, { align: 'center' });
                }
            }
          }
        },
      });
  }

      // Completar numeración total de páginas
      if (typeof doc.putTotalPages === 'function') {
        doc.putTotalPages(totalPagesExp);
      }

      doc.output('dataurlnewwindow');
    };