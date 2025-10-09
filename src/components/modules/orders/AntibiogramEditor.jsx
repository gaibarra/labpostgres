import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { listAntibioticClasses, listAntibiotics, getAntibiogramResults, upsertAntibiogramResults } from '@/lib/antibiogramApi';

export default function AntibiogramEditor({ open, onOpenChange, workOrder, analysisId }){
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({ q: '', className: '', activeOnly: true });
  const [catalog, setCatalog] = useState([]);
  const [rows, setRows] = useState(new Map()); // key: code -> { measure_type, value_numeric, unit, interpretation, comments }
  const [meta, setMeta] = useState({ organism: '', specimen_type: '', method: '', standard: 'CLSI', standard_version: '' });

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const [cls, list, existing] = await Promise.all([
        listAntibioticClasses(),
        listAntibiotics({ q: '', className: '', active: true, pageSize: 200 }),
        getAntibiogramResults({ work_order_id: workOrder?.id, analysis_id: analysisId, isolate_no: 1 })
      ]);
      setClasses(cls?.classes || []);
      setCatalog(list?.items || []);
      const m = new Map();
      const items = existing?.items || [];
      if (items.length){
        const r0 = items[0];
        setMeta({
          organism: r0.organism || '',
          specimen_type: r0.specimen_type || '',
          method: r0.method || '',
          standard: r0.standard || 'CLSI',
          standard_version: r0.standard_version || ''
        });
      }
      items.forEach(r => {
        m.set(r.antibiotic_code, {
          measure_type: r.measure_type || '',
          value_numeric: r.value_numeric == null ? '' : String(r.value_numeric),
          unit: r.unit || (r.measure_type === 'ZONE' ? 'mm' : (r.measure_type === 'MIC' ? 'ug/mL' : '')),
          interpretation: r.interpretation || '',
          comments: r.comments || ''
        });
      });
      setRows(m);
    } finally { setLoading(false); }
  }, [workOrder?.id, analysisId]);

  useEffect(()=>{ if (open) { init(); } }, [open, init]);


  const reloadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAntibiotics({ q: filters.q, className: filters.className, active: filters.activeOnly ? true : null, pageSize: 200 });
      setCatalog(list?.items || []);
    } finally { setLoading(false); }
  }, [filters.q, filters.className, filters.activeOnly]);

  useEffect(()=>{ if (open) { reloadCatalog(); } }, [open, reloadCatalog]);

  const display = useMemo(()=> catalog, [catalog]);

  function updateRow(code, patch){
    setRows(prev => {
      const next = new Map(prev);
      const curr = next.get(code) || {};
      const merged = { ...curr, ...patch };
      // auto unit
      if (patch.measure_type) {
        if (patch.measure_type === 'ZONE') merged.unit = 'mm';
        if (patch.measure_type === 'MIC') merged.unit = 'ug/mL';
      }
      next.set(code, merged);
      return next;
    });
  }

  async function handleSave(){
    const payload = {
      work_order_id: workOrder?.id,
      analysis_id: analysisId,
      isolate_no: 1,
      organism: meta.organism || null,
      specimen_type: meta.specimen_type || null,
      method: meta.method || null,
      standard: meta.standard || null,
      standard_version: meta.standard_version || null,
      results: []
    };
    for (const ab of display){
      const st = rows.get(ab.code);
      if (!st) continue;
      const any = st.measure_type || st.value_numeric || st.interpretation || st.comments;
      if (!any) continue;
      payload.results.push({
        antibiotic_code: ab.code,
        measure_type: st.measure_type || null,
        value_numeric: st.value_numeric === '' ? null : Number(st.value_numeric),
        unit: st.unit || null,
        interpretation: st.interpretation || null,
        comments: st.comments || null,
      });
    }
    setLoading(true);
    try {
      await upsertAntibiogramResults(payload);
      onOpenChange(false);
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl bg-slate-50 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sky-700 dark:text-sky-400">Antibiograma</DialogTitle>
          <DialogDescription>Registro de susceptibilidad por antibiótico (S/I/R) con medida de MIC o zona.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Card className="bg-white dark:bg-slate-800/50"><CardHeader><CardTitle className="text-sky-600 dark:text-sky-400">Metadatos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2"><Label>Organismo</Label><Input value={meta.organism} onChange={e=>setMeta(m=>({...m, organism:e.target.value}))} /></div>
              <div><Label>Método</Label>
                <Select value={meta.method||''} onValueChange={v=>setMeta(m=>({...m, method:v}))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kirby-Bauer">Kirby-Bauer (discos)</SelectItem>
                    <SelectItem value="MIC">MIC (microdilución)</SelectItem>
                    <SelectItem value="Etest">Etest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Estándar</Label>
                <Select value={meta.standard||'CLSI'} onValueChange={v=>setMeta(m=>({...m, standard:v}))}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLSI">CLSI</SelectItem>
                    <SelectItem value="EUCAST">EUCAST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Versión</Label><Input value={meta.standard_version} onChange={e=>setMeta(m=>({...m, standard_version:e.target.value}))} placeholder="2024"/></div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800/50"><CardHeader><CardTitle className="text-sky-600 dark:text-sky-400">Antibióticos</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-3 items-end">
                <div className="w-52"><Label>Buscar</Label><Input value={filters.q} onChange={e=>setFilters(f=>({...f, q:e.target.value}))} placeholder="Código o nombre"/></div>
                <div className="w-56"><Label>Clase</Label>
                  <Select value={filters.className} onValueChange={v=>setFilters(f=>({...f, className:v==='__ALL__'?'':v}))}>
                    <SelectTrigger><SelectValue placeholder="Todas"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">Todas</SelectItem>
                      {classes.map(c => (<SelectItem key={c.class} value={c.class}>{c.class} ({c.count})</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40"><Label>Solo activos</Label>
                  <Select value={filters.activeOnly? '1':'0'} onValueChange={v=>setFilters(f=>({...f, activeOnly: v==='1'}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Sí</SelectItem>
                      <SelectItem value="0">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto text-sm text-muted-foreground">{loading ? 'Cargando...' : `${display.length} antibióticos`}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b dark:border-slate-700">
                      <th className="py-2 pr-2">Código</th>
                      <th className="py-2 pr-2">Nombre</th>
                      <th className="py-2 pr-2">Medida</th>
                      <th className="py-2 pr-2">Valor</th>
                      <th className="py-2 pr-2">Unidad</th>
                      <th className="py-2 pr-2">S/I/R</th>
                      <th className="py-2 pr-2">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {display.map(ab => {
                      const st = rows.get(ab.code) || {};
                      return (
                        <tr key={ab.id} className="border-b last:border-b-0 dark:border-slate-800">
                          <td className="py-1 pr-2 whitespace-nowrap align-middle text-muted-foreground">{ab.code}</td>
                          <td className="py-1 pr-2 whitespace-nowrap align-middle">{ab.name}</td>
                          <td className="py-1 pr-2 w-36 align-middle">
                            <Select value={st.measure_type||''} onValueChange={v=>updateRow(ab.code,{ measure_type: v })}>
                              <SelectTrigger><SelectValue placeholder="-"/></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ZONE">ZONE</SelectItem>
                                <SelectItem value="MIC">MIC</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1 pr-2 w-32 align-middle"><Input type="number" step="0.01" value={st.value_numeric||''} onChange={e=>updateRow(ab.code, { value_numeric: e.target.value })}/></td>
                          <td className="py-1 pr-2 w-24 align-middle"><Input value={st.unit||''} onChange={e=>updateRow(ab.code, { unit: e.target.value })} placeholder="mm / ug/mL"/></td>
                          <td className="py-1 pr-2 w-28 align-middle">
                            <Select value={st.interpretation||''} onValueChange={v=>updateRow(ab.code,{ interpretation: v })}>
                              <SelectTrigger><SelectValue placeholder="-"/></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="S">S</SelectItem>
                                <SelectItem value="I">I</SelectItem>
                                <SelectItem value="R">R</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1 pr-2 align-middle"><Input value={st.comments||''} onChange={e=>updateRow(ab.code,{ comments: e.target.value })} placeholder="comentarios"/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="secondary" onClick={()=>onOpenChange(false)}>Cancelar</Button>
          <Button variant="default" onClick={handleSave} disabled={loading}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
