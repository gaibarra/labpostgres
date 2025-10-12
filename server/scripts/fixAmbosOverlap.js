#!/usr/bin/env node
/**
 * fixAmbosOverlap.js
 * Elimina de forma segura rangos "Ambos" REDUNDANTES cuando existen rangos
 * exactos para Masculino y Femenino con el mismo intervalo/método/valores.
 *
 * Reglas (conservadoras):
 *  - Solo elimina el rango "Ambos" si hay coincidencia exacta en:
 *    parameter_id, age_min, age_max, method, lower, upper, text_value
 *    y existen AMBOS rangos: Masculino y Femenino con esos mismos datos.
 *  - No recorta ni divide intervalos (no hay UPDATE parcial), solo DELETE seguro.
 *
 * Uso:
 *  node scripts/fixAmbosOverlap.js [--db=lab_mitenant] [--like="%Catecolaminas%|Epinefrina"] [--apply]
 *  - Sin --apply actúa en modo dry-run e imprime lo que haría.
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) {
  try { require('dotenv').config(); } catch (_) { /* ignore */ }
}
const { Pool } = require('pg');

function parseArgs(){
  const out={ apply:false };
  for (const a of process.argv.slice(2)){
    const m=a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a==='--apply') out.apply=true;
  }
  return out;
}

function buildFilter(val){
  if (!val) return { sql: '', params: [] };
  const pieces = String(val).split(/[|,]/).map(s=>s.trim()).filter(Boolean);
  if (!pieces.length) return { sql: '', params: [] };
  const conds=[]; const params=[];
  for (const t of pieces){
    const p = /[%_]/.test(t) ? t : `%${t}%`;
    params.push(p);
    const idx = params.length;
    conds.push(`(a.name ILIKE $${idx} OR a.category ILIKE $${idx} OR ap.name ILIKE $${idx})`);
  }
  return { sql: `AND (${conds.join(' OR ')})`, params };
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName){ console.error('Falta --db o variable PGDATABASE/TENANT_DB'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  const client = await pool.connect();
  try {
    const filter = buildFilter(args.like);
    const q = `
      WITH ambos AS (
        SELECT arr.id AS ambos_id, arr.parameter_id, arr.age_min, arr.age_max,
               COALESCE(arr.method,'') AS method,
               arr.lower, arr.upper, COALESCE(arr.text_value,'') AS text_value
        FROM analysis_reference_ranges arr
        JOIN analysis_parameters ap ON ap.id = arr.parameter_id
        JOIN analysis a ON a.id = ap.analysis_id
        WHERE arr.sex ILIKE 'ambos'
        ${filter.sql}
      ), matched AS (
        SELECT am.ambos_id, am.parameter_id, am.age_min, am.age_max, am.method,
               am.lower, am.upper, am.text_value
        FROM ambos am
        WHERE EXISTS (
          SELECT 1 FROM analysis_reference_ranges m
          WHERE m.parameter_id = am.parameter_id
            AND (m.sex ILIKE 'masculino' OR m.sex ILIKE 'm')
            AND COALESCE(m.method,'') = am.method
            AND m.age_min = am.age_min
            AND m.age_max = am.age_max
            AND COALESCE(m.lower, -1e18) = COALESCE(am.lower, -1e18)
            AND COALESCE(m.upper,  1e18) = COALESCE(am.upper,  1e18)
            AND COALESCE(m.text_value,'') = am.text_value
        )
        AND EXISTS (
          SELECT 1 FROM analysis_reference_ranges f
          WHERE f.parameter_id = am.parameter_id
            AND (f.sex ILIKE 'femenino' OR f.sex ILIKE 'f')
            AND COALESCE(f.method,'') = am.method
            AND f.age_min = am.age_min
            AND f.age_max = am.age_max
            AND COALESCE(f.lower, -1e18) = COALESCE(am.lower, -1e18)
            AND COALESCE(f.upper,  1e18) = COALESCE(am.upper,  1e18)
            AND COALESCE(f.text_value,'') = am.text_value
        )
      ), preview AS (
        SELECT m.ambos_id, a.name AS analysis, ap.name AS parameter,
               ap.unit, m.age_min, m.age_max, NULLIF(m.method,'') AS method,
               m.lower, m.upper, NULLIF(m.text_value,'') AS text_value
        FROM matched m
        JOIN analysis_reference_ranges arr ON arr.id = m.ambos_id
        JOIN analysis_parameters ap ON ap.id = arr.parameter_id
        JOIN analysis a ON a.id = ap.analysis_id
      )
      SELECT * FROM preview
      ORDER BY analysis, parameter, age_min, age_max, method NULLS FIRST`;

    const { rows } = await client.query(q, filter.params);
    if (!rows.length){
      console.log('[FixAmbos] No se encontraron rangos "Ambos" redundantes.');
      return;
    }
    const headers = ['AmbosID','Análisis','Parámetro','Unidad','Edad_min','Edad_max','Método','Lower','Upper','Texto'];
    console.log(headers.join('\t'));
    for (const r of rows){
      console.log([
        r.ambos_id,
        r.analysis,
        r.parameter,
        r.unit||'',
        r.age_min,
        r.age_max,
        r.method||'',
        r.lower==null?'':r.lower,
        r.upper==null?'':r.upper,
        r.text_value||''
      ].join('\t'));
    }
    if (!args.apply){
      console.error(`\n[FixAmbos] Dry-run: ${rows.length} rangos "Ambos" candidatos a eliminar. Ejecute con --apply para aplicar.`);
      return;
    }
    await client.query('BEGIN');
    const ids = rows.map(r=>r.ambos_id);
    const del = await client.query(
      `DELETE FROM analysis_reference_ranges WHERE id = ANY($1::uuid[]) RETURNING id`,
      [ids]
    );
    await client.query('COMMIT');
    console.log(`[FixAmbos] Eliminados ${del.rowCount} rangos "Ambos" redundantes.`);
  } catch (e){
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback error */ }
    console.error('[FixAmbos] Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module){ main(); }

module.exports = {};
