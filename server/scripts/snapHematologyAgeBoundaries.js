#!/usr/bin/env node
/**
 * snapHematologyAgeBoundaries.js
 * Normaliza límites de edad en parámetros de hematología para evitar solapes:
 * - 1..13  → 1..12
 * - 13..18 → 12..18
 * - 1..18  → 1..12 (solo si existe 12..18 para el mismo grupo)
 * Dedupe-aware: si el destino ya existe con mismos valores, borra la fila actual en lugar de actualizar.
 * Dry-run por defecto. Aplicar con --write.
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(e) { /* optional */ }

function parseArgs(){
  const out = { write:false };
  for (const a of process.argv.slice(2)){
    if (a === '--write') out.write = true; else {
      const m = a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName) { console.error('Falta --db'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  const report = { ok:true, inspected:0, updated:0, deleted:0, items:[] };
  try {
    const has = async (t)=>{ const { rows } = await pool.query('SELECT to_regclass($1) AS t',[`public.${t}`]); return !!rows[0].t; };
    const table = (await has('analysis_reference_ranges')) ? 'analysis_reference_ranges' : ((await has('reference_ranges')) ? 'reference_ranges' : null);
    if (!table) { console.log(JSON.stringify({ ok:false, error:'No range table' })); return; }
    const meta = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
    const cols = new Set(meta.rows.map(r=>r.column_name));
    const colLower = cols.has('lower') ? 'lower' : (cols.has('min_value') ? 'min_value' : null);
    const colUpper = cols.has('upper') ? 'upper' : (cols.has('max_value') ? 'max_value' : null);
    const colUnit  = cols.has('unit') ? 'unit' : null;
    const colText  = cols.has('text_value') ? 'text_value' : null;
    const colMethod= cols.has('method') ? 'method' : null;

    const like = args.like || 'Hemoglobina|Hematocrito|Eritrocitos|Hemoglobina Corpuscular Media|Met?hemoglobina|Hemoglobina A2';
    const { rows: targets } = await pool.query(`
      SELECT r.*
      FROM ${table} r
      JOIN analysis_parameters ap ON ap.id = r.parameter_id
      JOIN analysis a ON a.id = ap.analysis_id
      WHERE (ap.name ~* $1 OR a.name ~* $1)
        AND r.age_min IS NOT NULL AND r.age_max IS NOT NULL
        AND r.age_min >= 0 AND r.age_max <= 120
    `, [like]);
    report.inspected = targets.length;

    const existsRow = async (p) => {
      const fields = ['parameter_id','sex','age_min','age_max'];
      const vals = [p.parameter_id, p.sex, p.age_min, p.age_max];
      if (colLower) { fields.push(colLower); vals.push(p.lower); }
      if (colUpper) { fields.push(colUpper); vals.push(p.upper); }
      if (colUnit)  { fields.push(colUnit);  vals.push(p.unit); }
      if (colText)  { fields.push(colText);  vals.push(p.text_value); }
      if (colMethod){ fields.push(colMethod); vals.push(p.method); }
      const where = fields.map((c,i)=>`${c} IS NOT DISTINCT FROM $${i+1}`).join(' AND ');
      const { rows } = await pool.query(`SELECT id FROM ${table} WHERE ${where} LIMIT 1`, vals);
      return rows.length ? rows[0].id : null;
    };

    // Map rows by param,sex for quick lookups
    const byKey = new Map();
    for (const r of targets){
      const k = `${r.parameter_id}|${r.sex}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(r);
    }

    const plans = [];
  for (const [_key, arr] of byKey.entries()){
      // for each param+sex, compute presence of canonical bands
      const hasBand = (min,max)=> arr.some(x=>x.age_min===min && x.age_max===max);
      const has1218 = hasBand(12,18);
      for (const r of arr){
        const orig = { id:r.id, parameter_id:r.parameter_id, sex:r.sex, age_min:r.age_min, age_max:r.age_max, lower:r.lower, upper:r.upper, unit:r.unit, text_value:r.text_value, method:r.method };
        let target = null;
        if (r.age_min === 1 && r.age_max === 13) target = { ...orig, age_max: 12 };
        else if (r.age_min === 13 && r.age_max === 18) target = { ...orig, age_min: 12 };
        else if (r.age_min === 1 && r.age_max === 18 && has1218) target = { ...orig, age_max: 12 };
        if (!target) continue;
        plans.push({ type:'snap', from: orig, to: target });
      }
    }

    for (const p of plans){
      const existsId = await existsRow(p.to);
      if (existsId) {
        if (args.write) {
          await pool.query(`DELETE FROM ${table} WHERE id=$1`, [p.from.id]);
          report.deleted++;
          report.items.push({ action:'delete_duplicate_after_snap', id:p.from.id, to: { age_min:p.to.age_min, age_max:p.to.age_max } });
        } else {
          report.items.push({ action:'would_delete_duplicate_after_snap', id:p.from.id, to: { age_min:p.to.age_min, age_max:p.to.age_max } });
        }
      } else {
        if (args.write) {
          await pool.query(`UPDATE ${table} SET age_min=$1, age_max=$2 WHERE id=$3`, [p.to.age_min, p.to.age_max, p.from.id]);
          report.updated++;
          report.items.push({ action:'update_snap', id:p.from.id, from:{ age_min:p.from.age_min, age_max:p.from.age_max }, to:{ age_min:p.to.age_min, age_max:p.to.age_max } });
        } else {
          report.items.push({ action:'would_update_snap', id:p.from.id, from:{ age_min:p.from.age_min, age_max:p.from.age_max }, to:{ age_min:p.to.age_min, age_max:p.to.age_max } });
        }
      }
    }

    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    console.error('ERROR snapHematologyAgeBoundaries:', e.message);
    process.exit(1);
  } finally {
    await pool.end().catch(()=>{});
  }
}

if (require.main === module) main();
