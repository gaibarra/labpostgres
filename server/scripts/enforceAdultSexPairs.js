#!/usr/bin/env node
/**
 * enforceAdultSexPairs.js
 * Garantiza que para parámetros hormonales haya SIEMPRE ambos sexos (Masculino y Femenino)
 * en los tramos adultos canónicos: [12,18), [18,65), [65,120].
 *
 * Preferencias de valores (en orden):
 * 1) Plantilla por sexo y tramo.
 * 2) Plantilla 'Ambos' por tramo.
 * 3) Fila existente 'Ambos' en BD.
 * 4) Clonar del sexo opuesto existente en BD.
 *
 * Uso CLI:
 *   node server/scripts/enforceAdultSexPairs.js --db=lab_tenant [--like="Hormonal|Ginecol"] [--write]
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* opcional */ }
const { Pool } = require('pg');
const { buildParameterTemplate, SEGMENTS } = require('../utils/referenceTemplates');

function parseArgs(){
  const out = { write:false };
  for (const a of process.argv.slice(2)){
    if (a === '--write') out.write = true; else {
      const m = a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function normSex(v){
  const s = String(v || '').toLowerCase();
  if (['m','male','hombre','masculino'].includes(s)) return 'Masculino';
  if (['f','female','mujer','femenino'].includes(s)) return 'Femenino';
  return 'Ambos';
}

function buildFilterRegex(val){
  const like = (val && String(val)) || 'Hormonal|Ginecol';
  return like;
}

const ADULT_SEGMENTS = SEGMENTS.slice(3); // [12,18], [18,65], [65,120]

async function detectColumns(pool){
  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='analysis_reference_ranges'
  `);
  const cols = new Set(rows.map(r=>r.column_name));
  return {
    colLower: cols.has('lower') ? 'lower' : null,
    colUpper: cols.has('upper') ? 'upper' : null,
    colUnit: cols.has('unit') ? 'unit' : null,
    colText: cols.has('text_value') ? 'text_value' : null,
    colNotes: cols.has('notes') ? 'notes' : null,
    colMethod: cols.has('method') ? 'method' : null,
    colAgeUnit: cols.has('age_min_unit') ? 'age_min_unit' : null,
  };
}

function buildTemplateAdultMap(tpl){
  const map = new Map();
  if (!tpl || !Array.isArray(tpl.valorReferencia)) return map;
  for (const rr of tpl.valorReferencia){
    const key = `${rr.edadMin}-${rr.edadMax}`;
    if (!map.has(key)) map.set(key, { M:null, F:null, A:null });
    const cur = map.get(key);
    const rec = { min: rr.valorMin ?? null, max: rr.valorMax ?? null };
    if (rr.sexo === 'Masculino') cur.M = rec;
    else if (rr.sexo === 'Femenino') cur.F = rec;
    else cur.A = rec;
  }
  return map;
}

async function enforceAdultSexPairs(pool, opts){
  const likeRegex = buildFilterRegex(opts.like);

  const col = await detectColumns(pool);
  const report = { ok:true, matchedParameters:0, inserted:0, items:[] };

  // Seleccionamos parámetros relevantes
  const { rows: params } = await pool.query(`
    SELECT ap.id AS pid, ap.name AS pname, a.name AS aname
    FROM analysis a
    JOIN analysis_parameters ap ON ap.analysis_id = a.id
    WHERE (LOWER(a.name) ~* $1 OR LOWER(ap.name) ~* $1 OR COALESCE(a.code,'') ~* $1)
    ORDER BY a.name, ap.position NULLS LAST, ap.name
  `, [likeRegex]);
  report.matchedParameters = params.length;

  for (const p of params){
    const tpl = buildParameterTemplate(p.pname);
    const tmap = buildTemplateAdultMap(tpl);
    const preferredUnit = tpl?.unit || null;

    // Cargar filas existentes del parámetro
    const selCols = ['id','parameter_id','sex','age_min','age_max'];
    if (col.colLower) selCols.push(`${col.colLower} AS lower`);
    if (col.colUpper) selCols.push(`${col.colUpper} AS upper`);
    if (col.colUnit)  selCols.push(`${col.colUnit} AS unit`);
    if (col.colText)  selCols.push(`${col.colText} AS text_value`);
    if (col.colMethod) selCols.push(`${col.colMethod} AS method`);
    const { rows: ranges } = await pool.query(`SELECT ${selCols.join(', ')} FROM analysis_reference_ranges WHERE parameter_id=$1`, [p.pid]);

    // Indexar por tramo exacto
    const segMap = new Map(); // key -> { M,F,A }
    for (const r of ranges){
      const key = `${r.age_min}-${r.age_max}`;
      if (!segMap.has(key)) segMap.set(key, { M:null, F:null, A:null });
      const sex = normSex(r.sex);
      const cur = segMap.get(key);
      const rowLite = { age_min:r.age_min, age_max:r.age_max, lower:r.lower ?? null, upper:r.upper ?? null, text_value:r.text_value ?? null, unit:r.unit ?? preferredUnit };
      if (sex === 'Masculino') cur.M = rowLite; else if (sex === 'Femenino') cur.F = rowLite; else cur.A = rowLite;
    }

    for (const [a,b] of ADULT_SEGMENTS){
      const key = `${a}-${b}`;
      if (!segMap.has(key)) segMap.set(key, { M:null, F:null, A:null });
      const seg = segMap.get(key);

      for (const targetSex of ['Masculino','Femenino']){
        const has = targetSex === 'Masculino' ? !!seg.M : !!seg.F;
        if (has) continue; // ya existe ese sexo en ese tramo exacto

        // Determinar valores para insertar
        let lower = null, upper = null, text_value = null, unit = preferredUnit;
        const tplVals = tmap.get(key);
        if (tplVals){
          const tv = (targetSex === 'Masculino') ? tplVals.M : tplVals.F;
          if (tv && (tv.min!=null || tv.max!=null)) { lower = tv.min ?? null; upper = tv.max ?? null; }
          else if (tplVals.A && (tplVals.A.min!=null || tplVals.A.max!=null)) { lower = tplVals.A.min ?? null; upper = tplVals.A.max ?? null; }
        }
        // Fallbacks a datos existentes
        if (lower==null && upper==null){
          if (seg.A){ lower = seg.A.lower; upper = seg.A.upper; text_value = seg.A.text_value; unit = seg.A.unit || unit; }
          else if (targetSex === 'Masculino' && seg.F){ lower = seg.F.lower; upper = seg.F.upper; text_value = seg.F.text_value; unit = seg.F.unit || unit; }
          else if (targetSex === 'Femenino' && seg.M){ lower = seg.M.lower; upper = seg.M.upper; text_value = seg.M.text_value; unit = seg.M.unit || unit; }
        }

        // Si no hay ningún valor que poner, saltar
        if (lower==null && upper==null && text_value==null) continue;

        // Evitar duplicados exactos
        const checkParams = [p.pid, targetSex, a, b];
        const checkWhere = ['parameter_id=$1','sex=$2','age_min=$3','age_max=$4'];
        if (col.colLower){ checkWhere.push(`(${col.colLower} IS NOT DISTINCT FROM $${checkParams.length+1})`); checkParams.push(lower); }
        if (col.colUpper){ checkWhere.push(`(${col.colUpper} IS NOT DISTINCT FROM $${checkParams.length+1})`); checkParams.push(upper); }
        if (col.colText){  checkWhere.push(`(${col.colText} IS NOT DISTINCT FROM $${checkParams.length+1})`); checkParams.push(text_value); }
        if (col.colUnit){  checkWhere.push(`(${col.colUnit} IS NOT DISTINCT FROM $${checkParams.length+1})`); checkParams.push(unit); }
        if (col.colMethod){checkWhere.push(`(${col.colMethod} IS NOT DISTINCT FROM $${checkParams.length+1})`); checkParams.push(null); }
        const { rows: exists } = await pool.query(`SELECT id FROM analysis_reference_ranges WHERE ${checkWhere.join(' AND ')} LIMIT 1`, checkParams);
        if (exists.length) continue;

        if (opts.write){
          const insCols = ['parameter_id','sex','age_min','age_max'];
          const ph = ['$1','$2','$3','$4'];
          const insVals = [p.pid, targetSex, a, b];
          let i = 4;
          if (col.colAgeUnit){ insCols.push(col.colAgeUnit); ph.push(`$${++i}`); insVals.push('años'); }
          if (col.colLower){  insCols.push(col.colLower);  ph.push(`$${++i}`); insVals.push(lower); }
          if (col.colUpper){  insCols.push(col.colUpper);  ph.push(`$${++i}`); insVals.push(upper); }
          if (col.colText){   insCols.push(col.colText);   ph.push(`$${++i}`); insVals.push(text_value); }
          if (col.colUnit){   insCols.push(col.colUnit);   ph.push(`$${++i}`); insVals.push(unit); }
          if (col.colNotes){  insCols.push(col.colNotes);  ph.push(`$${++i}`); insVals.push('Enforced adult sex pair'); }
          if (col.colMethod){ insCols.push(col.colMethod); ph.push(`$${++i}`); insVals.push(null); }
          await pool.query(`INSERT INTO analysis_reference_ranges(${insCols.join(',')}) VALUES(${ph.join(',')})`, insVals);
          report.inserted++;
          report.items.push({ action:'insert', analysis:p.aname, parameter:p.pname, sex:targetSex, age_min:a, age_max:b, lower, upper, unit });
        } else {
          report.items.push({ action:'would-insert', analysis:p.aname, parameter:p.pname, sex:targetSex, age_min:a, age_max:b, lower, upper, unit });
        }
      }
    }
  }

  return report;
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName){ console.error('Falta --db o PGDATABASE'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  try {
    const res = await enforceAdultSexPairs(pool, { like: args.like, write: !!args.write });
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('[ENFORCE] Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end().catch(()=>{});
  }
}

if (require.main === module){
  main();
}

module.exports = { enforceAdultSexPairs };
