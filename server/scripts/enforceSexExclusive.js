#!/usr/bin/env node
/**
 * enforceSexExclusive.js
 * Convierte rangos con sexo "Ambos" a un sexo específico (Femenino o Masculino) para parámetros/estudios seleccionados.
 * - Soporta tablas modernas (analysis_reference_ranges) y legacy (reference_ranges).
 * - Evita duplicados: si ya existe un rango idéntico con el sexo destino, elimina el "Ambos"; si no, actualiza al sexo destino.
 * Uso:
 *   node server/scripts/enforceSexExclusive.js --db=lab_slug --target=Femenino --like="hCG|prueba de embarazo|beta-hcg" --write
 *   node server/scripts/enforceSexExclusive.js --db=lab_slug --target=Masculino --like="PSA|antígeno prostático" --write
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(err) { /* optional */ }

function parseArgs(){
  const out = { write:false };
  for (const a of process.argv.slice(2)){
    if (a === '--write') out.write = true; else {
      const m = a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
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

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  const target = String(args.target || '').trim();
  if (!dbName) { console.error('Falta --db'); process.exit(1); }
  if (!/^Femenino$|^Masculino$/.test(target)) { console.error('Falta --target=Femenino|Masculino'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  try {
    // Helper definido al inicio para satisfacer linters estrictos
    const processTable = async (table, targets) => {
      // introspect cols for compatibility
      const meta = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
      const cols = new Set(meta.rows.map(r=>r.column_name));
      const colLower = cols.has('lower') ? 'lower' : (cols.has('min_value') ? 'min_value' : null);
      const colUpper = cols.has('upper') ? 'upper' : (cols.has('max_value') ? 'max_value' : null);
      const colUnit  = cols.has('unit') ? 'unit' : null;
      const colText  = cols.has('text_value') ? 'text_value' : null;
      const colMethod= cols.has('method') ? 'method' : null;
      let updated = 0, deleted = 0; const items=[];
      for (const t of targets){
        // 1) Seleccionar filas Ambos
        const selCols = ['id','parameter_id','sex','age_min','age_max'];
        if (colLower) selCols.push(`${colLower} AS lower`);
        if (colUpper) selCols.push(`${colUpper} AS upper`);
        if (colUnit)  selCols.push(`${colUnit} AS unit`);
        if (colText)  selCols.push(`${colText} AS text_value`);
        if (colMethod) selCols.push(`${colMethod} AS method`);
        const { rows } = await pool.query(`SELECT ${selCols.join(', ')} FROM ${table} WHERE parameter_id=$1 AND (sex='Ambos' OR sex='O')`, [t.pid]);
        for (const r of rows){
          // 2) Ver si ya existe target con match exacto para evitar duplicado
          const matchCols = ['parameter_id','sex','age_min','age_max'];
          const vals = [t.pid, target, r.age_min, r.age_max];
          if (colLower) { matchCols.push(colLower); vals.push(r.lower); }
          if (colUpper) { matchCols.push(colUpper); vals.push(r.upper); }
          if (colUnit)  { matchCols.push(colUnit); vals.push(r.unit); }
          if (colText)  { matchCols.push(colText); vals.push(r.text_value); }
          if (colMethod){ matchCols.push(colMethod); vals.push(r.method); }
          const whereEq = matchCols.map((c,i)=> `${c} IS NOT DISTINCT FROM $${i+1}`).join(' AND ');
          const { rows: exists } = await pool.query(`SELECT id FROM ${table} WHERE ${whereEq} LIMIT 1`, vals);
          if (exists.length){
            if (args.write) {
              await pool.query(`DELETE FROM ${table} WHERE id=$1`, [r.id]);
              deleted++;
              items.push({ action:'delete_ambos_dup', table, parameter_id:t.pid, parameter:t.pname, analysis:t.aname, range:{ age_min:r.age_min, age_max:r.age_max } });
            } else {
              items.push({ action:'would_delete_ambos_dup', table, parameter_id:t.pid, parameter:t.pname, analysis:t.aname, range:{ age_min:r.age_min, age_max:r.age_max } });
            }
          } else {
            if (args.write) {
              await pool.query(`UPDATE ${table} SET sex=$1 WHERE id=$2`, [target, r.id]);
              updated++;
              items.push({ action:'update_ambos_to_target', table, parameter_id:t.pid, parameter:t.pname, analysis:t.aname, range:{ age_min:r.age_min, age_max:r.age_max } });
            } else {
              items.push({ action:'would_update_ambos_to_target', table, parameter_id:t.pid, parameter:t.pname, analysis:t.aname, range:{ age_min:r.age_min, age_max:r.age_max } });
            }
          }
        }
      }
      return { updated, deleted, items };
    };
    const hasTbl = async (t)=>{ const { rows } = await pool.query('SELECT to_regclass($1) AS t',[`public.${t}`]); return !!rows[0].t; };
    const hasModern = await hasTbl('analysis_reference_ranges');
    const hasLegacy = await hasTbl('reference_ranges');
    const { sql: filterSql, params } = buildFilter(args.like);
    const queryTargets = `
      SELECT ap.id AS pid, ap.name AS pname, a.name AS aname
      FROM analysis a
      JOIN analysis_parameters ap ON ap.analysis_id = a.id
      ${filterSql}
      ORDER BY a.name, ap.position NULLS LAST, ap.name
    `;
    const { rows: targets } = await pool.query(queryTargets, params);
  if (!targets.length) { console.log(JSON.stringify({ ok:true, updated:0, deleted:0, matched:0, items:[] }, null, 2)); return; }
  let updated=0, deleted=0, matched=targets.length; const items=[];
    if (hasModern) { const r = await processTable('analysis_reference_ranges', targets); updated+=r.updated; deleted+=r.deleted; items.push(...r.items); }
    if (hasLegacy) { const r = await processTable('reference_ranges', targets); updated+=r.updated; deleted+=r.deleted; items.push(...r.items); }
    console.log(JSON.stringify({ ok:true, matched, updated, deleted, items }, null, 2));
  } catch (e) {
    console.error('ERROR enforceSexExclusive:', e.message);
    process.exit(1);
  }
}

if (require.main === module) main();
