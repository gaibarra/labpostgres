#!/usr/bin/env node
/**
 * backfillMethodSpecificRanges.js
 * Duplica rangos existentes para analitos método-dependientes (IGF-1, metanefrinas)
 * creando copias etiquetadas por "method" cuando no existen.
 *
 * Uso (dry-run por defecto):
 *  node server/scripts/backfillMethodSpecificRanges.js --db=lab_gonzalo --write
 *  --like="%IGF-1%|%Metanefrina%" opcional para acotar.
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) {
  try { require('dotenv').config(); } catch (_) { /* ignore */ }
}
const { Pool } = require('pg');

function parseArgs(){
  const out={ write:false };
  for (const a of process.argv.slice(2)){
    if (a==='--write') out.write=true; else {
      const m=a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]]=m[2];
    }
  }
  return out;
}

async function hasColumn(pool, table, column){
  const { rows } = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2", [table, column]);
  return rows.length>0;
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName) { console.error('Falta --db'); process.exit(1);}    
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName
  });
  try {
    const hasARR = await pool.query("SELECT to_regclass('public.analysis_reference_ranges') t");
    if (!hasARR.rows[0].t) { console.log('[METHOD] No existe analysis_reference_ranges'); return; }
    if (!await hasColumn(pool,'analysis_reference_ranges','method')) { console.log('[METHOD] Columna method no existe; ejecute migraciones.'); return; }

    const like = args.like ? String(args.like) : '%';
    const q = `
      SELECT a.name aname, ap.id pid, ap.name pname, COALESCE(ap.unit, a.general_units) unit,
             arr.id rid, arr.sex, arr.age_min, arr.age_max, arr.lower, arr.upper, arr.text_value, arr.unit as range_unit, arr.method
      FROM analysis a
      JOIN analysis_parameters ap ON ap.analysis_id=a.id
      LEFT JOIN analysis_reference_ranges arr ON arr.parameter_id=ap.id
      WHERE (a.name ILIKE $1 OR ap.name ILIKE $1) AND (a.name ~* '(IGF|Metanefrina|Normetanefrina|catecolaminas)' OR ap.name ~* '(IGF|Metanefrina|Normetanefrina|catecolaminas)')
      ORDER BY a.name, ap.position NULLS LAST, ap.name, arr.created_at`;
    const { rows } = await pool.query(q, [like]);
    // Agrupar por parámetro
    const byParam = new Map();
    for (const r of rows){
      if (!byParam.has(r.pid)) byParam.set(r.pid, { aname:r.aname, pname:r.pname, unit:r.unit, ranges:[] });
      if (r.rid) byParam.get(r.pid).ranges.push(r);
    }
    const targetMethods = ['LC-MS/MS','Inmunoensayo'];
    const inserts=[];
    for (const [pid, p] of byParam){
      // si ya hay method definido, saltar clon para ese método
      const existingByMethod = new Map();
      for (const r of p.ranges){
        const key = (r.method||'').toLowerCase();
        const list = existingByMethod.get(key) || []; list.push(r); existingByMethod.set(key, list);
      }
      // Tomar como plantilla cualquier rango sin method o con method vacío
      const templates = (existingByMethod.get('') || []).concat(existingByMethod.get(null)||[]);
      if (!templates.length) continue;
      for (const m of targetMethods){
        if (existingByMethod.has(m.toLowerCase())) continue;
        for (const t of templates){
          inserts.push({ pid, aname:p.aname, pname:p.pname, sex:t.sex, a0:t.age_min, a1:t.age_max, lower:t.lower, upper:t.upper, text:t.text_value, unit: t.range_unit || p.unit, method:m });
        }
      }
    }
    if (!inserts.length){ console.log('[METHOD] No hay inserciones propuestas.'); return; }
    console.log('Análisis\tParámetro\tUnidad\tMétodo\tInserción');
    inserts.forEach(x=>{
      const val = x.text ? `text:"${x.text}"` : `${x.lower}–${x.upper}`;
      console.log(`${x.aname}\t${x.pname}\t${x.unit||''}\t${x.method}\t[${x.sex||'Ambos'} ${x.a0}–${x.a1} ${val}]`);
    });
    if (args.write){
      let total=0;
      for (const ins of inserts){
        await pool.query(`INSERT INTO analysis_reference_ranges(parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, text_value, unit, method)
                          VALUES($1,$2,$3,$4,'años',$5,$6,$7,$8,$9)`,
                         [ins.pid, ins.sex||'Ambos', ins.a0, ins.a1, ins.lower, ins.upper, ins.text||null, ins.unit||null, ins.method]);
        total++;
      }
      console.log(`[METHOD] Insertadas ${total} filas etiquetadas por método.`);
    } else {
      console.log('\n[METHOD] Dry-run: use --write para aplicar.');
    }
  } catch (e){
    console.error('[METHOD] Error:', e.message);
    process.exit(1);
  } finally { await pool.end(); }
}

if (require.main === module){ main(); }

module.exports = {};
