#!/usr/bin/env node
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(e) { /* optional .env */ }

async function main(){
  const dbName = process.env.PGDATABASE;
  const pool = new Pool();
  const introspect = async (table) => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
    const set = new Set(rows.map(r=>r.column_name));
    const colLower = set.has('lower') ? 'lower' : (set.has('min_value') ? 'min_value' : null);
    const colUpper = set.has('upper') ? 'upper' : (set.has('max_value') ? 'max_value' : null);
    const colUnit  = set.has('unit') ? 'unit' : null;
    const colText  = set.has('text_value') ? 'text_value' : null;
    const colMethod= set.has('method') ? 'method' : null;
    const colAgeMinUnit = set.has('age_min_unit') ? 'age_min_unit' : null;
    return { colLower, colUpper, colUnit, colText, colMethod, colAgeMinUnit };
  };
  const run = async (table) => {
    const meta = await introspect(table);
    const lowerExpr = meta.colLower ? meta.colLower : `NULL::numeric`;
    const upperExpr = meta.colUpper ? meta.colUpper : `NULL::numeric`;
    const unitExpr  = meta.colUnit  ? meta.colUnit  : `NULL::text`;
    const textExpr  = meta.colText  ? meta.colText  : `NULL::text`;
    const methodExpr= meta.colMethod? meta.colMethod: `NULL::text`;
    const ageMinUnitExpr = meta.colAgeMinUnit ? meta.colAgeMinUnit : `'años'`;
    const keyCols = `parameter_id, COALESCE(sex,'Ambos') AS sex, COALESCE(age_min,-1) AS age_min, COALESCE(age_max,-1) AS age_max,
      COALESCE(${ageMinUnitExpr},'años') AS age_min_unit, COALESCE(${lowerExpr}, -999999::numeric) AS lower,
      COALESCE(${upperExpr}, -999999::numeric) AS upper,
      COALESCE(${textExpr},'') AS text_value, COALESCE(${unitExpr},'') AS unit, COALESCE(${methodExpr},'') AS method`;
    const { rows } = await pool.query(`
      WITH ranked AS (
        SELECT id, ${keyCols}, ROW_NUMBER() OVER (
          PARTITION BY parameter_id, COALESCE(sex,'Ambos'), COALESCE(age_min,-1), COALESCE(age_max,-1), COALESCE(${ageMinUnitExpr},'años'),
                       COALESCE(${lowerExpr}, -999999::numeric),
                       COALESCE(${upperExpr}, -999999::numeric),
                       COALESCE(${textExpr},''), COALESCE(${unitExpr},''), COALESCE(${methodExpr},'')
          ORDER BY id
        ) AS rn
        FROM ${table}
      )
      SELECT id FROM ranked WHERE rn > 1
    `);
    let del = 0;
    for (const r of rows){ await pool.query(`DELETE FROM ${table} WHERE id=$1`, [r.id]); del++; }
    return del;
  };
  const tables = [];
  const has = async (t)=>{ const { rows } = await pool.query('SELECT to_regclass($1) AS t',[`public.${t}`]); return !!rows[0].t; };
  if (await has('analysis_reference_ranges')) tables.push('analysis_reference_ranges');
  if (await has('reference_ranges')) tables.push('reference_ranges');
  let total=0; for (const t of tables){ total += await run(t); }
  console.log(JSON.stringify({ ok:true, deleted: total, db: dbName, tables }, null, 2));
  await pool.end();
}
main().catch(e=>{ console.error(e); process.exit(1); });
