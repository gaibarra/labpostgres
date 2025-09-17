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
      getStudiesAndParametersForOrder
    ) => {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 10;
      const headerHeight = 85;

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

      const studiesToRenderInPdf = getStudiesAndParametersForOrder(order.selected_items, studiesDetails, packagesData);
      let mainContent = [];
      
      studiesToRenderInPdf.forEach(studyDetail => {
        mainContent.push([{ content: studyDetail.name, colSpan: 4, styles: { fillColor: [241, 245, 249], textColor: [14, 116, 144], fontStyle: 'bold', fontSize: 11, cellPadding: 2.5 } }]);
        
        const resultsForStudy = order.results?.[studyDetail.id] || [];
        const parameters = studyDetail.parameters || [];

        if (parameters.length > 0) {
          parameters.forEach(param => {
            const resultEntry = resultsForStudy.find(r => r.parametroId === param.id);
            let resultValueToDisplay = "PENDIENTE";
            if (resultEntry && resultEntry.valor !== undefined && resultEntry.valor !== null && String(resultEntry.valor).trim() !== '') {
                resultValueToDisplay = String(resultEntry.valor);
            }

            const refData = getReferenceRangeText(param, patient, patientAgeData, true);
            const refRangeText = refData.valueText === 'N/A' ? 'N/A' : `${refData.valueText}\n${refData.demographics}`;
            
            mainContent.push([
                param.name,
                resultValueToDisplay,
                param.unit || studyDetail.general_units || '',
                refRangeText,
                param,
            ]);
          });
        } else {
            mainContent.push([{ content: "Este estudio no tiene parámetros definidos.", colSpan: 4, styles: { fontStyle: 'italic', textColor: [100, 116, 139], halign: 'center', cellPadding: 3 } }]);
        }
      });


  autoTable(doc, {
        theme: 'grid',
        head: [['Parámetro', 'Resultado', 'Unidades', 'Valores de Referencia']],
        body: mainContent,
        startY: headerHeight,
        margin: { top: headerHeight },
        showHead: 'firstPage',
        headStyles: { 
            fillColor: [248, 250, 252], 
            textColor: [30, 41, 59],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [203, 213, 225], 
        },
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle', font: 'helvetica' },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 'auto', fontSize: 7.5 },
        },
        didDrawCell: (data) => {
          if (data.column.index === 1 && data.cell.section === 'body') {
            const param = data.row.raw[4];
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
              const param = data.row.raw[4];
              if (!param) {
                  data.row.cells[0].colSpan = 4;
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
          // Header
          let yPos = 10;
          if (labLogo && reportSettings.showLogoInReport) {
            try {
              const img = new Image();
              img.src = labLogo;
              const aspectRatio = img.width / img.height;
              const logoHeight = 12;
              const logoWidth = logoHeight * aspectRatio;
              doc.addImage(img, 'PNG', margin, yPos, logoWidth, logoHeight);
            } catch (e) { console.error("Error al cargar logo para PDF:", e); }
          }
      
          doc.setFontSize(14).setFont(undefined, 'bold');
          doc.setTextColor(30, 58, 138); 
          doc.text(labName, pageWidth / 2, yPos + 4, { align: 'center' });
          yPos += 5;

          doc.setFontSize(8).setFont(undefined, 'normal');
          doc.setTextColor(100, 116, 139);
          if (fullAddress) {
            doc.text(fullAddress, pageWidth / 2, yPos + 4, { align: 'center' });
            yPos += 4;
          }
          let contactString = [];
          if (labPhone) contactString.push(`Tel: ${labPhone}`);
          if (labEmail) contactString.push(`Email: ${labEmail}`);
          if (contactString.length > 0) {
            doc.text(contactString.join(' | '), pageWidth / 2, yPos + 4, { align: 'center' });
          }
          yPos += 10;
          
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 8;
      
          doc.setFontSize(12).setFont(undefined, 'bold');
          doc.setTextColor(51, 65, 85);
          const reportTitle = reportSettings.defaultHeader || "Reporte de Resultados";
          const titleWidth = doc.getStringUnitWidth(reportTitle) * doc.internal.getFontSize() / doc.internal.scaleFactor;
          const titleX = (pageWidth - titleWidth) / 2;
          doc.text(reportTitle, titleX, yPos);
          yPos += 8;

          autoTable(doc, {
            startY: yPos,
            body: patientInfoGrid,
            theme: 'plain',
            styles: { fontSize: 8.5, cellPadding: 0.8, overflow: 'linebreak' },
            columnStyles: { 
              0: { fontStyle: 'bold', textColor: [51, 65, 85] }, 
              2: { fontStyle: 'bold', textColor: [51, 65, 85] }, 
            },
          });

          // Footer
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8).setFont(undefined, 'italic');
          doc.setTextColor(100, 116, 139);
          const footerText = reportSettings.defaultFooter || 'Gracias por su preferencia. Los resultados deben ser interpretados por un médico.';
          doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
          doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });

          if (data.pageNumber === pageCount) {
            const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : undefined;
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

      doc.output('dataurlnewwindow');
    };