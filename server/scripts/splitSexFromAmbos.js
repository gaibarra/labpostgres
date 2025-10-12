#!/usr/bin/env node
/**
 * splitSexFromAmbos.js
 * Crea rangos por sexo (Masculino/Femenino) clonando los rangos existentes con sexo "Ambos"
 * para parámetros que actualmente no tienen splits por sexo.
 * - Mantiene los rangos "Ambos" (el selector de referencia en frontend prioriza exactos M/F).
 * - Copia lower/upper/text_value/unit/method y age_min/max y fija age_min_unit si existe.
 * - Añade notes='Auto-split from Ambos' si la columna existe.
 *
 * Uso:
 *   node scripts/splitSexFromAmbos.js --db=lab --like="PSA|Estradiol|FSH|LH|Progesterona|Prolactina|GH|Testosterona Libre Calculada" --write
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
    // introspect columns
    const meta = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='analysis_reference_ranges'`);
    const cols = new Set(meta.rows.map(r=>r.column_name));
    const hasAgeUnit = cols.has('age_min_unit');
    const hasText = cols.has('text_value');
    const hasNotes = cols.has('notes');
    const hasUnit = cols.has('unit');
    const hasMethod = cols.has('method');

    const { sql, params } = buildFilter(args.like);
    const q = `
      SELECT a.name aname, ap.id pid, ap.name pname,
             arr.id rid, arr.sex, arr.age_min, arr.age_max, arr.age_min_unit,
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
      if (!byParam.has(key)) byParam.set(key, { aname:r.aname, pname:r.pname, rows:[] });
      byParam.get(key).rows.push(r);
    }
    const inserts=[];
    for (const entry of byParam.values()){
      const rows = entry.rows.filter(r=>r.rid!=null);
      if (!rows.length) continue;
      const sexes = new Set(rows.map(r=>normSex(r.sex)));
      const hasM = sexes.has('Masculino');
      const hasF = sexes.has('Femenino');
      const hasA = sexes.has('Ambos');
      if (!hasA || (hasM && hasF)) continue; // nothing to do
      const ambosRows = rows.filter(r=>normSex(r.sex)==='Ambos');
      for (const ar of ambosRows){
        for (const targetSex of ['Masculino','Femenino']){
          inserts.push({
            pid: ar.pid || entry.rows[0].pid,
            sex: targetSex,
            age_min: ar.age_min ?? null,
            age_max: ar.age_max ?? null,
            age_min_unit: hasAgeUnit ? (ar.age_min_unit || 'años') : null,
            lower: ar.lower ?? null,
            upper: ar.upper ?? null,
            text_value: hasText ? (ar.text_value ?? null) : null,
            unit: hasUnit ? (ar.runit ?? null) : null,
            method: hasMethod ? (ar.method ?? null) : null,
            notes: hasNotes ? 'Auto-split from Ambos' : null,
            aname: entry.aname,
            pname: entry.pname
          });
        }
      }
    }

    if (!inserts.length){ console.log('[SPLIT] No se encontraron parámetros candidatos.'); return; }

    console.log('Análisis\tParámetro\tSexo nuevo\tCopia de (Ambos)');
    for (const i of inserts){
      const valueDesc = i.text_value ? `text:"${i.text_value}"` : `${i.lower ?? 'null'}–${i.upper ?? 'null'}`;
      console.log(`${i.aname}\t${i.pname}\t${i.sex}\t${i.age_min ?? 'null'}–${i.age_max ?? 'null'} ${valueDesc}`);
    }

    if (args.write){
      let total=0;
      for (const i of inserts){
        const colsIns = ['parameter_id','sex','age_min','age_max'];
        const vals = [i.pid, i.sex, i.age_min, i.age_max];
        if (hasAgeUnit){ colsIns.push('age_min_unit'); vals.push(i.age_min_unit); }
        colsIns.push('lower','upper'); vals.push(i.lower, i.upper);
        if (hasText){ colsIns.push('text_value'); vals.push(i.text_value); }
        if (hasNotes){ colsIns.push('notes'); vals.push(i.notes); }
        if (hasUnit){ colsIns.push('unit'); vals.push(i.unit); }
        if (hasMethod){ colsIns.push('method'); vals.push(i.method); }
        const ph = colsIns.map((_,idx)=>`$${idx+1}`);
        await pool.query(`INSERT INTO analysis_reference_ranges(${colsIns.join(',')}) VALUES(${ph.join(',')})`, vals);
        total++;
      }
      console.log(`[SPLIT] Insertadas ${total} filas M/F a partir de Ambos.`);
    } else {
      console.log('\n[SPLIT] Dry-run: usa --write para aplicar.');
    }

  } finally { await pool.end(); }
}

if (require.main === module){
  main().catch(e=>{ console.error('[SPLIT] Error:', e.message); process.exit(1); });
}

module.exports = {};
