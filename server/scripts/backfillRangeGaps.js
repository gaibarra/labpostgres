#!/usr/bin/env node
/**
 * backfillRangeGaps.js
 * Rellena gaps de cobertura 0–120 años por parámetro copiando el valor más cercano adyacente.
 * - Opera sobre analysis_reference_ranges
 * - Respeta splits por sexo existentes (rellena dentro de cada sexo y también en "Ambos" si aplica)
 * - No inventa números: replica lower/upper/text_value del tramo adyacente más cercano.
 * - age_min_unit se fija a 'años' para gaps entre tramos expresados en años.
 *
 * Uso:
 *   node scripts/backfillRangeGaps.js --db=lab --like="IGF-1|Metanefrina" --write
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { try{ require('dotenv').config(); } catch(_err){ /* ignore */ } }
const { Pool } = require('pg');

function parseArgs(){
  const out={ write:false, like:null };
  for (const a of process.argv.slice(2)){
    if (a==='--write') out.write=true; else {
      const m=a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function buildFilter(val){
  if (!val) return { sql:'', params:[] };
  const parts = String(val).split(/[|,]/).map(s=>s.trim()).filter(Boolean);
  if (!parts.length) return { sql:'', params:[] };
  const conds=[]; const params=[];
  for (const t of parts){
    const p = /[%_]/.test(t) ? t : `%${t}%`;
    params.push(p); const i=params.length;
    conds.push(`(a.name ILIKE $${i} OR ap.name ILIKE $${i})`);
  }
  return { sql: `WHERE ${conds.join(' OR ')}`, params };
}

function normSex(v){
  const s=(v||'').toString().trim().toLowerCase();
  if (['m','masculino'].includes(s)) return 'Masculino';
  if (['f','femenino'].includes(s)) return 'Femenino';
  return 'Ambos';
}

function mergeIntervals(intervals){
  if (!intervals.length) return [];
  const srt = intervals.slice().sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
  const out=[]; let [cs, ce] = srt[0];
  for (let i=1;i<srt.length;i++){ const [s,e]=srt[i]; if (s<=ce) ce=Math.max(ce,e); else { out.push([cs,ce]); [cs,ce]=[s,e]; } }
  out.push([cs,ce]); return out;
}

function invertCoverage(merged, domain=[0,120]){
  const gaps=[]; let c=domain[0];
  for (const [s,e] of merged){ if (s>c) gaps.push([c, Math.min(s,domain[1])]); c=Math.max(c,e); if (c>=domain[1]) break; }
  if (c<domain[1]) gaps.push([c,domain[1]]);
  return gaps.filter(([a,b])=>b>a);
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName){ console.error('Falta --db'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  try {
    const { sql, params } = buildFilter(args.like);
    const q = `
      SELECT a.name aname, ap.id pid, ap.name pname, COALESCE(ap.unit, a.general_units) unit,
             arr.id rid, arr.parameter_id, arr.sex, arr.age_min, arr.age_max, arr.age_min_unit,
             arr.lower, arr.upper, arr.text_value, arr.unit as runit, arr.method
      FROM analysis a
      JOIN analysis_parameters ap ON ap.analysis_id = a.id
      LEFT JOIN analysis_reference_ranges arr ON arr.parameter_id = ap.id
      ${sql}
      ORDER BY a.name, ap.position NULLS LAST, ap.name, arr.age_min NULLS FIRST
    `;
    const { rows } = await pool.query(q, params);
    const byParam = new Map();
    for (const r of rows){
      const key = r.pid;
      if (!byParam.has(key)) byParam.set(key, { aname:r.aname, pname:r.pname, unit:r.unit, rows:[] });
      byParam.get(key).rows.push(r);
    }
    const inserts=[];
    for (const p of byParam.values()){
      const buckets = { Masculino:[], Femenino:[], Ambos:[] };
      for (const r of p.rows){ if (!r) continue; buckets[normSex(r.sex)].push(r); }
      for (const sexKey of Object.keys(buckets)){
        const list = buckets[sexKey].filter(r=>r.age_min!=null || r.age_max!=null);
        if (!list.length) continue;
        const spans = list.map(r=>[r.age_min==null?0:r.age_min, r.age_max==null?120:r.age_max]);
        const merged = mergeIntervals(spans);
        const gaps = invertCoverage(merged);
        if (!gaps.length) continue;
        // Para cada gap, elegir plantilla adyacente más cercana (prev o next) y copiar sus valores.
        for (const [gs, ge] of gaps){
          // buscar tramo con end==gs o start==ge
          const prev = list.find(r => (r.age_max==null?120:r.age_max) === gs);
          const next = list.find(r => (r.age_min==null?0:r.age_min) === ge);
          const template = prev || next || list[0];
          inserts.push({
            pid: template.parameter_id || p.rows[0].parameter_id || p.rows[0].pid,
            sex: sexKey,
            age_min: gs,
            age_max: ge,
            age_min_unit: 'años',
            lower: template.lower ?? null,
            upper: template.upper ?? null,
            text_value: template.text_value ?? null,
            unit: template.runit || p.unit || null,
            method: template.method || null,
            aname: p.aname,
            pname: p.pname
          });
        }
      }
    }
    if (!inserts.length){ console.log('[GAPS] No se encontraron gaps a rellenar.'); return; }
    console.log('Análisis\tParámetro\tSexo\tGap\tPlantilla valor');
    for (const i of inserts){
      const valueDesc = i.text_value ? `text:"${i.text_value}"` : `${i.lower ?? 'null'}–${i.upper ?? 'null'}`;
      console.log(`${i.aname}\t${i.pname}\t${i.sex}\t${i.age_min}–${i.age_max}\t${valueDesc}`);
    }
    if (args.write){
      let total=0;
      for (const i of inserts){
        await pool.query(
          `INSERT INTO analysis_reference_ranges(parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, text_value, unit, method, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [i.pid, i.sex, i.age_min, i.age_max, i.age_min_unit, i.lower, i.upper, i.text_value, i.unit, i.method, 'Auto-fill gap']
        );
        total++;
      }
      console.log(`[GAPS] Insertadas ${total} filas para rellenar gaps.`);
    } else {
      console.log('\n[GAPS] Dry-run: usa --write para aplicar.');
    }
  } finally { await pool.end(); }
}

if (require.main === module){
  main().catch(e=>{ console.error('[GAPS] Error:', e.message); process.exit(1); });
}

module.exports = {};
