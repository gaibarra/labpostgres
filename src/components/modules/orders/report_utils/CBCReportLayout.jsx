import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from '@/lib/utils';

const titleClass = "text-[13px] font-semibold text-sky-900 dark:text-sky-200 tracking-wide";

function groupParams(parameters = []) {
  const list = parameters || [];
  // const byName = (n) => list.find(p => (p.name || '').toLowerCase() === n.toLowerCase());
  const findAny = (arr) => list.filter(p => arr.some(k => (p.name || '').toLowerCase().includes(k)));

  // Serie Roja
  const rojaOrder = [
    'Hemoglobina','Hematocrito','Eritrocitos','Volumen globular Medio','VCM','Hemoglobina glob. med.','HCM','Conc. media de Hb glob.','CHCM','RDW','Reticulocitos'
  ];
  const roja = [];
  const consumed = new Set();
  rojaOrder.forEach(n => {
    const hit = list.find(p => (p.name || '').toLowerCase() === n.toLowerCase());
    if (hit) { roja.push(hit); consumed.add(hit.id || hit.name); }
  });

  // Serie Plaquetaria
  const plaquetaria = [];
  const plateCandidates = findAny(['plaquet','vmp','mpv']);
  plateCandidates.forEach(p => { const key = p.id || p.name; if (!consumed.has(key)) { plaquetaria.push(p); consumed.add(key); } });

  // Serie Blanca
  const blanca = [];
  const blancaKeys = ['leucocitos','neutrófilos','neutrofilos','segmentados','banda','metamielocitos','mielocitos','promielocitos','blastos','eosinófilos','eosinofilos','basófilos','basofilos','monocitos','linfocitos'];
  const whiteCandidates = findAny(blancaKeys);
  whiteCandidates.forEach(p => { const key = p.id || p.name; if (!consumed.has(key)) { blanca.push(p); consumed.add(key); } });

  // Otros no clasificados
  const otros = list.filter(p => !consumed.has(p.id || p.name));
  if (otros.length) {
    // Añadir sobrantes a blanca para mantener dos columnas equilibradas
    blanca.push(...otros);
  }
  return { roja, plaquetaria, blanca };
}

// Nota: se mantuvo un renderer único (TableWithValues) para evitar duplicados.

// Renderiza dos columnas: izquierda (roja + plaquetaria) y derecha (blanca)
const CBCReportLayout = ({ studyDetail, orderResults, compact = false, renderResultCell, getReferenceRangeText, patient, patientAgeData }) => {
  const { roja, plaquetaria, blanca } = groupParams(studyDetail.parameters || []);

  const fillValues = (rows) => rows.map(p => {
    const r = (orderResults || []).find(e => String(e.parametroId) === String(p.id));
    return { ...p, _valor: r && r.valor !== undefined && r.valor !== null && String(r.valor).trim() !== '' ? r.valor : 'PENDIENTE' };
  });

  const rojaFilled = fillValues(roja);
  const plaqFilled = fillValues(plaquetaria);
  const blancaFilled = fillValues(blanca);

  // Helper para inyectar el valor con el renderer del componente padre
  const TableWithValues = ({ title, items }) => (
    <Card className="bg-white dark:bg-slate-800/50 shadow border dark:border-slate-700/40">
      <CardHeader className={cn("bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700", compact ? "py-1.5 px-3" : "py-2 px-4") }>
        <CardTitle className={cn(titleClass, compact ? "text-[12px]" : "text-[13px]")}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table className={cn("text-xs", compact ? "[&_*]:leading-[1.1]" : "")}>
          <TableHeader>
            <TableRow className="bg-slate-50/60 dark:bg-slate-700/30">
              <TableHead className={cn(compact ? "py-1.5" : "py-2", "pl-3 font-semibold text-slate-600 dark:text-slate-300")}>Parámetro</TableHead>
              <TableHead className={cn(compact ? "py-1.5" : "py-2", "text-center font-semibold text-slate-600 dark:text-slate-300 w-[30%]")}>Resultado</TableHead>
              <TableHead className={cn(compact ? "py-1.5" : "py-2", "text-center font-semibold text-slate-600 dark:text-slate-300 w-[25%]")}>Unidades / Ref.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(p => {
              const refData = getReferenceRangeText ? getReferenceRangeText(p, patient, patientAgeData, true) : null;
              const refText = refData && refData.valueText !== 'N/A' ? refData.valueText : '';
              const demo = refData && refData.valueText !== 'N/A' ? refData.demographics : '';
              return (
                <TableRow key={p.id || p.name}>
                  <TableCell className={cn(compact ? "py-1.5" : "py-2.5", "pl-3 font-medium text-slate-700 dark:text-slate-200")}>{p.name}</TableCell>
                  <TableCell className={cn(compact ? "py-1.5" : "py-2.5", "text-center")}>{renderResultCell(p._valor, { parametroId: p.id })}</TableCell>
                  <TableCell className={cn(compact ? "py-1.5" : "py-2.5", "text-center text-slate-600 dark:text-slate-300") }>
                    <div className="leading-tight flex flex-col items-center">
                      <span className="text-xs text-slate-600 dark:text-slate-300">{p.unit || ''}</span>
                      {refText ? (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{refText}{demo ? ` · ${demo}` : ''}</span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // Tabla especial para Serie Blanca con columnas Absoluto y %
  const WhiteSeriesTable = ({ items }) => {
    // Helpers similares al PDF para permitir cálculo derivado
    const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const toNum = (val) => {
      if (val === null || typeof val === 'undefined') return null;
      const n = parseFloat(String(val).replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    const fmtAbs = (n) => (n === null || typeof n === 'undefined') ? '—' : String(Number(n.toFixed(1)));
    const fmtPct = (n) => (n === null || typeof n === 'undefined') ? '—' : String(Math.round(n));

    const isTotalLeuk = (name) => {
      const t = norm(name);
      return (t.includes('leucocitos') && t.includes('total')) || t.includes('wbc');
    };

    // Localiza Leucocitos Totales y su valor numérico
    const totalLeukParam = items.find(p => isTotalLeuk(p?.name || ''));
    const totalLeuk = totalLeukParam ? toNum(totalLeukParam._valor) : null;

    // Render de filas con cálculo derivado cuando aplique
    return (
      <Card className="bg-white dark:bg-slate-800/50 shadow border dark:border-slate-700/40">
        <CardHeader className={cn("bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700", compact ? "py-1.5 px-3" : "py-2 px-4") }>
          <CardTitle className={cn(titleClass, compact ? "text-[12px]" : "text-[13px]")}>Serie Blanca</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className={cn("text-xs", compact ? "[&_*]:leading-[1.1]" : "") }>
            <TableHeader>
              <TableRow className="bg-slate-50/60 dark:bg-slate-700/30">
                <TableHead className={cn(compact ? "py-1.5" : "py-2", "pl-3 font-semibold text-slate-600 dark:text-slate-300")}>Parámetro</TableHead>
                <TableHead className={cn(compact ? "py-1.5" : "py-2", "text-center font-semibold text-slate-600 dark:text-slate-300 w-[28%]")}>Absoluto</TableHead>
                <TableHead className={cn(compact ? "py-1.5" : "py-2", "text-center font-semibold text-slate-600 dark:text-slate-300 w-[22%]")}>%</TableHead>
                <TableHead className={cn(compact ? "py-1.5" : "py-2", "pr-3 text-left font-semibold text-slate-600 dark:text-slate-300")}>Valores de Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(p => {
                const isPercent = String(p.unit || '').includes('%') || /%|porcentaje/i.test(String(p.name || ''));
                const refData = getReferenceRangeText ? getReferenceRangeText(p, patient, patientAgeData, true) : null;
                const refText = refData && refData.valueText !== 'N/A' ? refData.valueText : '';
                const demoText = refData && refData.valueText !== 'N/A' ? refData.demographics : '';
                const absUnit = !isPercent ? (p.unit || '') : (studyDetail.general_units || '');

                // Valores directos
                const directValNum = toNum(p._valor);

                // Derivados: si es porcentaje y tenemos total, calculamos absoluto; si es absoluto y hay total, calculamos %
                const derivedAbs = (isPercent && totalLeuk !== null && directValNum !== null) ? (directValNum / 100) * totalLeuk : null;
                const derivedPct = (!isPercent && totalLeuk !== null && directValNum !== null && totalLeuk > 0) ? (directValNum / totalLeuk) * 100 : null;

                return (
                  <TableRow key={p.id || p.name}>
                    <TableCell className={cn(compact ? "py-1.5" : "py-2.5", "pl-3 font-medium text-slate-700 dark:text-slate-200")}>{p.name}</TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-2.5", "text-center") }>
                      <div className="flex flex-col items-center leading-tight">
                        {/* Absoluto directo (con evaluación) o derivado (neutro) */}
                        {!isPercent && renderResultCell(p._valor, { parametroId: p.id })}
                        {isPercent && (
                          derivedAbs !== null ? (
                            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{fmtAbs(derivedAbs)}</span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{absUnit}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn(compact ? "py-1.5" : "py-2.5", "text-center") }>
                      <div className="flex flex-col items-center leading-tight">
                        {/* % directo (con evaluación) o derivado (neutro) */}
                        {isPercent && renderResultCell(p._valor, { parametroId: p.id })}
                        {!isPercent && (
                          derivedPct !== null ? (
                            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{fmtPct(derivedPct)}</span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">%</span>
                      </div>
                    </TableCell>
                    {/* Columna de Valores de Referencia */}
                    <TableCell className={cn(compact ? "py-1.5" : "py-2.5", "pr-3") }>
                      {refText ? (
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{isPercent ? `${refText}%` : refText}</span>
                          {demoText ? (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{demoText}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("grid gap-3", "md:grid-cols-2") }>
      <div className="space-y-3">
        <TableWithValues title="Serie Roja" items={rojaFilled} />
        {plaqFilled.length > 0 && <TableWithValues title="Serie Plaquetaria" items={plaqFilled} />}
      </div>
      <div className="space-y-3">
        <WhiteSeriesTable items={blancaFilled} />
      </div>
    </div>
  );
};

export default CBCReportLayout;
