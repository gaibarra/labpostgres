import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Renders an Antibiogram section inside the Results Report preview.
// Props:
// - data: { meta: { organism, specimen_type, method, standard, standard_version }, rows: Array<{ antibiotic_name, antibiotic_class, measure_type, value_numeric, unit, interpretation, comments }> }
// - compact: boolean (smaller paddings/fonts)
export default function AntibiogramReportSection({ data, compact = false }){
  const meta = data?.meta || {};
  const rows = React.useMemo(() => Array.isArray(data?.rows) ? data.rows : [], [data?.rows]);

  const grouped = useMemo(() => {
    const byClass = new Map();
    for (const r of rows) {
      const key = r.antibiotic_class || '(Sin clase)';
      if (!byClass.has(key)) byClass.set(key, []);
      byClass.get(key).push(r);
    }
    // Sort each group by antibiotic name
  for (const arr of byClass.values()) {
      arr.sort((a,b)=> String(a.antibiotic_name||'').localeCompare(String(b.antibiotic_name||'')));
    }
    return Array.from(byClass.entries());
  }, [rows]);

  const fmtMeasure = (r) => {
    const v = (r?.value_numeric ?? '') === '' || r?.value_numeric == null ? '' : String(r.value_numeric);
    const u = r?.unit || '';
    const mt = r?.measure_type || '';
    if (!v && !u && !mt) return '—';
    if (mt && v && u) return `${mt}: ${v} ${u}`;
    if (mt && v) return `${mt}: ${v}`;
    if (v && u) return `${v} ${u}`;
    return mt || v || u || '—';
  };

  return (
    <Card className="bg-white dark:bg-slate-800/50 shadow-md border dark:border-slate-700/40 overflow-hidden">
      <CardHeader className={(compact ? 'py-1.5 px-3' : 'py-2 px-4') + ' bg-slate-100 dark:bg-slate-800 rounded-t-lg border-b dark:border-slate-700'}>
        <CardTitle className={(compact ? 'text-sm' : 'text-base') + ' font-semibold text-sky-800 dark:text-sky-300'}>Antibiograma</CardTitle>
        {(meta.organism || meta.specimen_type || meta.method || meta.standard) && (
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-0.5">
            {meta.organism && (<span><strong>Organismo:</strong> {meta.organism}</span>)}
            {meta.specimen_type && (<span><strong>Muestra:</strong> {meta.specimen_type}</span>)}
            {meta.method && (<span><strong>Método:</strong> {meta.method}</span>)}
            {meta.standard && (<span><strong>Estándar:</strong> {meta.standard}{meta.standard_version ? (' ' + meta.standard_version) : ''}</span>)}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">Sin datos de antibiograma registrados.</div>
        ) : (
          grouped.map(([className, items]) => (
            <div key={className} className="">
              <div className="px-4 py-1.5 text-[12px] font-semibold text-sky-700 dark:text-sky-300 bg-slate-50/50 dark:bg-slate-700/30 border-t dark:border-slate-700/50">{className}</div>
              <Table className={(compact ? 'text-[11px] [&_*]:leading-[1.1]' : 'text-xs')}>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-700/30 hover:bg-slate-100/70 dark:hover:bg-slate-700/40">
                    <TableHead className={(compact ? 'py-1.5' : 'py-2') + ' pl-4 w-[40%] text-slate-600 dark:text-slate-300 font-semibold'}>Antibiótico</TableHead>
                    <TableHead className={(compact ? 'py-1.5' : 'py-2') + ' text-center w-[25%] text-slate-600 dark:text-slate-300 font-semibold'}>Medida</TableHead>
                    <TableHead className={(compact ? 'py-1.5' : 'py-2') + ' text-center w-[10%] text-slate-600 dark:text-slate-300 font-semibold'}>S/I/R</TableHead>
                    <TableHead className={(compact ? 'py-1.5' : 'py-2') + ' pr-4 w-[25%] text-slate-600 dark:text-slate-300 font-semibold'}>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r, idx) => (
                    <TableRow key={`${r.antibiotic_name}-${idx}`} className="even:bg-slate-50/40 dark:even:bg-slate-800/20 hover:bg-sky-50/30 dark:hover:bg-sky-800/10 border-b dark:border-slate-700/50 last:border-b-0">
                      <TableCell className={(compact ? 'py-1.5' : 'py-2.5') + ' pl-4 font-medium text-slate-700 dark:text-slate-200'}>{r.antibiotic_name}</TableCell>
                      <TableCell className={(compact ? 'py-1.5' : 'py-2.5') + ' text-center text-slate-700 dark:text-slate-200'}>{fmtMeasure(r)}</TableCell>
                      <TableCell className={(compact ? 'py-1.5' : 'py-2.5') + ' text-center'}>
                        <span className="inline-flex items-center justify-center text-[11px] font-bold rounded-full px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100">{r.interpretation || '—'}</span>
                      </TableCell>
                      <TableCell className={(compact ? 'py-1.5' : 'py-2.5') + ' pr-4 text-slate-500 dark:text-slate-400'}>{r.comments || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
