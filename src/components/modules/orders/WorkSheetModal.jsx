import React, { useMemo, useRef, useState } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { useReactToPrint } from 'react-to-print';
    import { Printer, X } from 'lucide-react';
    import ReportHeader from '@/components/modules/orders/report_utils/ReportHeader';
    import { useOrderManagement } from './hooks/useOrderManagement';
    import { useEvaluationUtils } from './report_utils/evaluationUtils';
    import { Switch } from '@/components/ui/switch';
    import { Label } from '@/components/ui/label';
    import { cn } from '@/lib/utils';

    import { useSettings } from '@/contexts/SettingsContext';
    const WorkSheetModal = ({ isOpen, onClose, order, studiesDetails, packagesDetails, patientDetails }) => {
      const componentRef = useRef();
      const { settings } = useSettings();
      const { getStudiesAndParametersForOrder } = useOrderManagement();
      const { calculateAgeInUnits, getReferenceRangeText } = useEvaluationUtils();
      const [isCompactView, setIsCompactView] = useState(true);

      const handlePrintDirect = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Hoja_de_Trabajo_${order?.folio || 'folio'}`,
      });

      const previewWorksheet = () => {
        try {
          const title = `Hoja_de_Trabajo_${order?.folio || 'folio'}`;
          // Build a compact, fixed header that repeats on every printed page
          // and highlights patient name and folio.
          const patient = patientDetails;
          const ageText = patient?.date_of_birth
            ? `${calculateAgeInUnits(patient.date_of_birth).ageYears} años`
            : 'N/A';
          const takeDate = order?.order_date ? new Date(order.order_date) : null;
          const takeDateStr = takeDate ? takeDate.toLocaleDateString() : 'N/A';
          const takeTimeStr = takeDate ? takeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
          const reportDateStr = new Date().toLocaleDateString();
          const headerHtml = `
            <div class='fixed-header'>
              <div class='row title-row'>
                <div class='title'>Hoja de Trabajo</div>
              </div>
              <div class='row main-row'>
                <div class='patient'><span class='lbl'>Paciente:</span> <span class='value patient-name'>${patient?.full_name || 'N/A'}</span></div>
                <div class='folio'><span class='lbl'>Folio:</span> <span class='value folio-value'>${order?.folio || 'N/A'}</span></div>
              </div>
              <div class='row meta-row'>
                <div><span class='lbl small'>Edad:</span> <span class='value'>${ageText}</span></div>
                <div><span class='lbl small'>Sexo:</span> <span class='value'>${patient?.sex || 'N/A'}</span></div>
                <div><span class='lbl small'>Fecha de toma:</span> <span class='value'>${takeDateStr}</span></div>
                <div><span class='lbl small'>Hora de toma:</span> <span class='value'>${takeTimeStr}</span></div>
                <div><span class='lbl small'>Fecha de reporte:</span> <span class='value'>${reportDateStr}</span></div>
                <div><span class='lbl small'>Médico:</span> <span class='value'>N/A</span></div>
              </div>
            </div>`;

          // Build body (studies/packages) with columns.
          const isCompact = isCompactView;
          const columnClass = isCompact ? 'columns-4' : 'columns-3';
          const studyHtmlParts = [];
          // Compute age data locally for reference range calculations in print HTML
          const ageDataLocal = patient?.date_of_birth ? calculateAgeInUnits(patient.date_of_birth) : { ageYears:0, unit:'años', fullMonths:0, fullDays:0 };
          worksheetGroups.forEach(group => {
            if (group.type === 'package') {
              studyHtmlParts.push(`<div class='pkg-wrapper'>
                <div class='pkg-band'>
                  <span>PAQUETE: ${group.name}</span>
                </div>
                ${group.studies.map(study => `<div class='study-box'>
                  <h4>${study.name}</h4>
                  ${renderParamsForPreview(study.parameters, isCompact, study.name, patientDetails, ageDataLocal)}
                </div>`).join('')}
              </div>`);
            } else {
              const study = group;
              studyHtmlParts.push(`<div class='study-box'>
                <h4>${study.name}</h4>
                ${renderParamsForPreview(study.parameters, isCompact, study.name, patientDetails, ageDataLocal)}
              </div>`);
            }
          });
          const studiesHtml = `<div class='${columnClass} worksheet-columns'>${studyHtmlParts.join('')}</div>`;

          const html = `<!doctype html><html><head><meta charset='utf-8'/><title>${title}</title>
          <style>
            @page { size: Letter portrait; margin: 0.35in; }
            :root{ --page-margin: 0.35in; --header-height: 0.95in; }
            html,body{background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;margin:0; padding:0; font-size:13px;}
            body{width:8.5in;box-sizing:border-box;margin:0 auto; padding:calc(var(--page-margin) + var(--header-height)) var(--page-margin) var(--page-margin) var(--page-margin);}
            h1,h2,h3,h4{margin:4px 0;font-weight:600;font-family:Arial,Helvetica,sans-serif;}
            .fixed-header{position:fixed;top:0;left:0;right:0;background:#fff;box-sizing:border-box;padding:calc(var(--page-margin) - 0.05in) var(--page-margin) 4px;border-bottom:1px solid #e2e8f0;}
            .fixed-header .row{display:flex; align-items:center; justify-content:space-between;}
            .fixed-header .title-row .title{width:100%; text-align:center; font-size:18px; font-weight:700; margin-bottom:2px;}
            .fixed-header .main-row{gap:12px;}
            .fixed-header .patient .lbl,.fixed-header .folio .lbl{font-weight:700;color:#475569;}
            .fixed-header .patient .value{font-weight:800;color:#0f172a;font-size:17px;}
            .fixed-header .folio .value{font-weight:800;color:#0f172a;font-size:17px;}
            .fixed-header .meta-row{display:grid; grid-template-columns:repeat(6, auto); gap:12px 16px; margin-top:4px; font-size:11px;}
            .fixed-header .meta-row .small{font-weight:700;color:#475569;margin-right:4px;}
            .worksheet-columns{column-gap:18px;}
            .columns-3{column-count:3;}
            .columns-4{column-count:4;}
            /* Allow content to flow and avoid giant empty areas */
            .worksheet-columns > div{margin:0 0 10px;}
            .pkg-band{background:#f5f7ff;border:1px solid #d9e0ff;border-radius:4px;padding:4px 8px;margin:0 0 6px;font-size:11px;font-weight:700;color:#243b6b;display:flex;justify-content:flex-start;align-items:center;}
            .study-box{border:1px solid #e2e8f0;border-radius:4px;}
              .study-box h4{background:#f1f5f9;padding:4px 6px;border-radius:4px 4px 0 0;font-size:13px;}
            .param-container{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:6px;}
              .param-item{font-size:12px;}
            .param-item .label{font-weight:600;color:#334155;display:block;}
            .param-item .line{height:12px;border-bottom:1px dotted #64748b;margin-top:2px;}
            .param-item .ref{margin-top:2px;font-size:10px;color:#475569;line-height:1.15;}
            .compact .param-container{grid-template-columns:1fr;}
            table{border-collapse:collapse;}
            @media print{ body{ padding:calc(var(--page-margin) + var(--header-height)) var(--page-margin) var(--page-margin) var(--page-margin); } .actions{display:none;} .worksheet-columns{column-gap:12px;} }
            .patient-name{font-size:17px;}
          </style></head><body class='${isCompact ? 'compact':''}'>
          ${headerHtml}
          <div style='border-top:1px solid #e2e8f0;margin:4px 0 10px;'></div>
          ${studiesHtml}
          </body></html>`;
          // Print via hidden iframe to skip the visible preview window and go straight to the print dialog
          try {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const cleanup = () => {
              try { document.body.removeChild(iframe); } catch(_) { /* ignore */ }
            };

            const onAfterPrint = () => {
              try { iframe.contentWindow?.removeEventListener('afterprint', onAfterPrint); } catch(_) { /* ignore */ }
              cleanup();
            };

            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) throw new Error('No iframe document');
            doc.open();
            doc.write(html);
            doc.close();

            iframe.onload = () => {
              try {
                iframe.contentWindow?.addEventListener('afterprint', onAfterPrint);
                setTimeout(() => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch(_) { cleanup(); handlePrintDirect(); } }, 80);
              } catch(_) { cleanup(); handlePrintDirect(); }
            };
          } catch (_) {
            // Fallback: try the direct component print; if that fails, last resort open window
            try { handlePrintDirect(); } catch (_) {
              const w = window.open('', '_blank');
              if (!w) return;
              w.document.open();
              w.document.write(html);
              w.document.close();
              try { w.focus(); setTimeout(()=>{ try { w.print(); } catch(_) { /* ignore */ } }, 150); } catch(_) { /* ignore */ }
            }
          }
        } catch(e) {
          console.warn('[Worksheet][preview failed]', e.message);
          handlePrintDirect();
        }
      };

      // Helper to render parameters for preview (avoid dependency on tailwind) reused above.
      const renderParamsForPreview = (params, isCompact, studyName, patient, ageData) => {
        if (!params || !params.length) {
          return `<div style='padding:6px;font-size:11px;font-style:italic;color:#64748b;'>Sin parámetros definidos.</div>`;
        }
        const trimmedStudy = (studyName || '').toString().trim().toLowerCase();
        const singleMatchesStudy = params.length === 1 && (params[0]?.name || '').toString().trim().toLowerCase() === trimmedStudy;
        if (isCompact) {
          if (singleMatchesStudy) {
            return `<div class='param-container'><div class='param-item'><div class='line'></div></div></div>`;
          }
          return `<div class='param-container'>${params.map(p => `<div class='param-item'><span class='label'>${p.name}:</span><div class='line'></div></div>`).join('')}</div>`;
        }
        // Two columns detailed version with reference placeholder line
        const mid = Math.ceil(params.length/2);
        const col1 = params.slice(0, mid);
        const col2 = params.slice(mid);
        const refText = (p) => {
          try { return getReferenceRangeText(p, patient, ageData); } catch { return ''; }
        };
        const makeCol = (list) => list.map(p => {
          const showLabel = !(singleMatchesStudy && p === params[0]);
          return `<div class='param-item'><span class='label'>${showLabel ? (p.name + ':') : ''}</span><div class='line'></div><div class='ref'>Ref: ${refText(p)}</div></div>`;
        }).join('');
        if (singleMatchesStudy) {
          // Put single line spanning both columns with reference beneath.
          return `<div class='param-container'><div class='param-item' style='grid-column:1 / -1;'><div class='line'></div><div class='ref'>Ref: ${refText(params[0])}</div></div></div>`;
        }
        return `<div class='param-container'>${makeCol(col1)}${makeCol(col2)}</div>`;
      };

      // Build grouped structure preserving package boundaries so worksheet can display package names distinctly.
      const worksheetGroups = useMemo(() => {
        if (!order || !order.selected_items || !studiesDetails || !packagesDetails) return [];
        const studiesMap = new Map(studiesDetails.map(s => [String(s.id), s]));
        const packagesMap = new Map(packagesDetails.map(p => [String(p.id), p]));
        const groups = [];
        const addedStudyIds = new Set();

        const addStudyIfNot = (studyId, targetArray) => {
          const key = String(studyId);
            if (addedStudyIds.has(key)) return;
            const s = studiesMap.get(key);
            if (s) { targetArray.push(JSON.parse(JSON.stringify(s))); addedStudyIds.add(key); }
        };

        const expandPackage = (pack) => {
          const studiesInPack = [];
          if (Array.isArray(pack.items)) {
            pack.items.forEach(it => {
              if (it.item_type === 'analysis' || it.item_type === 'study') {
                addStudyIfNot(it.item_id, studiesInPack);
              } else if (it.item_type === 'package') { // nested package
                const nested = packagesMap.get(String(it.item_id));
                if (nested) {
                  expandPackage(nested); // nested will push separately as its own group
                }
              }
            });
          }
          if (studiesInPack.length) {
            groups.push({ type: 'package', id: pack.id, name: pack.name || 'Paquete', studies: studiesInPack });
          } else {
            // Show empty package placeholder if no direct studies
            groups.push({ type: 'package', id: pack.id, name: pack.name || 'Paquete', studies: [] });
          }
        };

        // Preserve order of selected_items
        for (const raw of order.selected_items) {
          const item = { ...raw, id: raw.id || raw.item_id, type: raw.type || raw.item_type };
          if (!item.id || !item.type) continue;
          if (item.type === 'package') {
            const pack = packagesMap.get(String(item.id));
            if (pack) expandPackage(pack);
          } else if (item.type === 'analysis' || item.type === 'study') {
            addStudyIfNot(item.id, groups);
          }
        }

        // Include inferred studies (from results) that were not in selected_items (edge cases)
        const inferred = getStudiesAndParametersForOrder(order.selected_items, studiesDetails, packagesDetails);
        inferred.forEach(s => { if (!addedStudyIds.has(String(s.id))) groups.push(JSON.parse(JSON.stringify(s))); });
        return groups;
      }, [order, studiesDetails, packagesDetails, getStudiesAndParametersForOrder]);

      const patientAgeData = useMemo(() => {
        if (patientDetails?.date_of_birth) {
          return calculateAgeInUnits(patientDetails.date_of_birth);
        }
        return { ageYears: 0, unit: 'años', fullMonths: 0, fullDays: 0 };
      }, [patientDetails?.date_of_birth, calculateAgeInUnits]);

  if (!isOpen || !order || !patientDetails) return null;
  const labInfo = settings?.labInfo || {};

      const StandardView = () => (
        <div className="columns-3 gap-x-6">
          {worksheetGroups.map((group, index) => {
            if (group.type === 'package') {
              return (
                <div key={`pkg-${group.id}`} className={`break-inside-avoid mb-4 ${index > 0 ? 'pt-2' : ''}`}>
                  <div className="bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 rounded-md px-3 py-1.5 mb-2 flex items-center justify-between">
                    <span className="text-indigo-800 dark:text-indigo-300 font-bold tracking-wide">PAQUETE: {group.name}</span>
                    <span className="text-xs text-indigo-700 dark:text-indigo-400">{group.studies.length} estudio(s)</span>
                  </div>
                  {group.studies.length === 0 && ( 
                    <p className="text-xs italic text-slate-500 mb-3">(Este paquete no contiene estudios directos o están ya incluidos en otro paquete.)</p> 
                  )} 
                  {group.studies.map(study => ( 
                    <div key={`pkg-${group.id}-study-${study.id}`} className="mb-3">
                      <h4 className="text-base font-semibold text-center bg-sky-100 dark:bg-sky-900/50 py-1 rounded-t-md text-sky-800 dark:text-sky-300">{study.name}</h4>
                      <div className="border-x border-b rounded-b-md p-2">
                        {renderParametersInTwoColumns(study.parameters, study.name)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            // Plain study group (not inside a package)
            const study = group; // when group is a study object
            return (
              <div key={`study-${study.id}`} className={`break-inside-avoid mb-4 ${index > 0 ? 'pt-2' : ''}`}>
                <h4 className="text-lg font-semibold text-center bg-sky-100 dark:bg-sky-900/50 py-1.5 rounded-t-lg text-sky-800 dark:text-sky-300">{study.name}</h4>
                <div className="border-x border-b rounded-b-lg p-2">
                  {renderParametersInTwoColumns(study.parameters, study.name)}
                </div>
              </div>
            );
          })}
        </div>
      );
      
  const renderParametersInTwoColumns = (parameters, studyName) => {
        if (!parameters || parameters.length === 0) { 
          return <p className="text-sm text-center text-slate-500 p-4">Este estudio no tiene parámetros definidos.</p>;
        }
  const normalizedStudy = (studyName || '').trim().toLowerCase();
        const singleMatchesStudy = parameters.length === 1 && (parameters[0]?.name || '').trim().toLowerCase() === normalizedStudy;
        const midPoint = Math.ceil(parameters.length / 2);
        const col1 = parameters.slice(0, midPoint);
        const col2 = parameters.slice(midPoint);

        return (
          <div className="grid grid-cols-2 gap-x-4">
            <div> 
              {(singleMatchesStudy ? [{...parameters[0], name: ''}] : col1).map((param, pIndex) => ( 
                <div key={pIndex} className="text-sm py-1 break-inside-avoid"> 
                  {param.name && (<span className="font-semibold text-slate-700 dark:text-slate-300">{param.name}:</span>)} 
                  <div className="w-full h-4 border-b border-dotted border-slate-500 my-1"></div> 
                  {!singleMatchesStudy && ( 
                    <div className="text-xs text-slate-500 dark:text-slate-400"> 
                      Ref: {getReferenceRangeText(param, patientDetails, patientAgeData)} 
                    </div> 
                  )} 
                </div> 
              ))} 
            </div> 
            <div> 
              {(singleMatchesStudy ? [] : col2).map((param, pIndex) => ( 
                <div key={pIndex} className="text-sm py-1 break-inside-avoid"> 
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{param.name}:</span> 
                  <div className="w-full h-4 border-b border-dotted border-slate-500 my-1"></div> 
                  <div className="text-xs text-slate-500 dark:text-slate-400"> 
                     Ref: {getReferenceRangeText(param, patientDetails, patientAgeData)} 
                  </div> 
                </div> 
              ))} 
            </div> 
          </div>
        );
      };

      const CompactView = () => (
        <div className="columns-4 gap-x-4">
          {worksheetGroups.map(group => {
            if (group.type === 'package') {
              return (
                <div key={`compact-pkg-${group.id}`} className="break-inside-avoid mb-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-600 rounded px-2 py-1 mb-1">{group.name}</div>
                  {group.studies.map(study => (
                    <div key={`compact-pkg-${group.id}-study-${study.id}`} className="mb-2">
                      <h4 className="text-[0.80rem] font-semibold text-sky-800 dark:text-sky-300 py-0.5">{study.name}</h4>
                      {(study.parameters?.length === 1 && study.parameters[0]?.name?.trim().toLowerCase() === study.name?.trim().toLowerCase())
                        ? (
                          <div className="text-xs py-0.5">
                            <div className="w-full h-2 border-b border-dotted border-slate-500 mt-0.5"></div>
                          </div>
                        )
                        : (
                          study.parameters?.map((param, pIndex) => (
                            <div key={pIndex} className="text-xs py-0.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{param.name}:</span>
                              <div className="w-full h-2 border-b border-dotted border-slate-500 mt-0.5"></div>
                            </div>
                          ))
                        )}
                    </div>
                  ))}
                </div>
              );
            }
            const study = group;
            return (
              <div key={`compact-study-${study.id}`} className="break-inside-avoid mb-3">
                <h4 className="text-[0.80rem] font-semibold text-sky-800 dark:text-sky-300 py-0.5">{study.name}</h4>
                {(study.parameters?.length === 1 && study.parameters[0]?.name?.trim().toLowerCase() === study.name?.trim().toLowerCase())
                  ? (
                    <div className="text-xs py-0.5">
                      <div className="w-full h-2 border-b border-dotted border-slate-500 mt-0.5"></div>
                    </div>
                  )
                  : (
                    study.parameters?.map((param, pIndex) => (
                      <div key={pIndex} className="text-xs py-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{param.name}:</span>
                        <div className="w-full h-2 border-b border-dotted border-slate-500 mt-0.5"></div>
                      </div>
                    ))
                  )}
              </div>
            );
          })}
        </div>
      );

      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2 border-b dark:border-slate-700">
              <div className="flex justify-between items-center">
                <div>
                  <DialogTitle className="text-2xl font-bold text-sky-700 dark:text-sky-400">Hoja de Trabajo - Folio: {order.folio}</DialogTitle>
                  <DialogDescription>Seleccione el formato de la hoja de trabajo.</DialogDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="compact-view-switch" className={cn("text-sm", !isCompactView && "text-sky-600 font-semibold")}>Estándar</Label>
                  <Switch
                    id="compact-view-switch"
                    checked={isCompactView}
                    onCheckedChange={setIsCompactView}
                  />
                  <Label htmlFor="compact-view-switch" className={cn("text-sm", isCompactView && "text-sky-600 font-semibold")}>Compacta</Label>
                </div>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-grow">
               <div className="p-6">
                <div ref={componentRef} className="print-friendly-worksheet">
                  <table className="w-full print-table">
                    <thead className="print-header">
                      <tr>
                        <td>
                          <div className="print-header-content">
                            <ReportHeader 
                              labInfo={labInfo}
                              order={order}
                              patient={patientDetails}
                              patientAgeData={patientAgeData}
                              isWorksheet={true}
                            />
                          </div>
                        </td>
                      </tr>
                    </thead>
                    <tbody className="print-body">
                      <tr>
                        <td>
                          <div className="printable-content pt-4">
                            {isCompactView ? <CompactView /> : <StandardView />}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="print-footer">
                      <tr>
                        <td>
                          <div className="print-footer-content"></div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
               </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900/50">
              <Button variant="outline" onClick={onClose} className="mr-auto">
                <X className="mr-2 h-4 w-4" /> Cerrar
              </Button>
              <Button onClick={previewWorksheet}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir / Guardar PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default WorkSheetModal;