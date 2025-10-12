#!/usr/bin/env node
/**
 * backfillMethodRanges.js
 * Duplica rangos existentes para crear variantes por método en analitos método-dependientes.
 * Enfoque inicial: IGF-1 y metanefrinas (plasma y orina), creando copias con method si faltan.
 *
 * Uso:
 *   node scripts/backfillMethodRanges.js --db=lab_gonzalo --terms="IGF-1,Metanefrina,Normetanefrina" --method="LC-MS/MS" --write
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { try{ require('dotenv').config(); } catch(_err){ /* ignore */ } }
const { Pool } = require('pg');

function parseArgs(){
  const out={ write:false, method:null, terms:null };
  for (const a of process.argv.slice(2)){
    if (a==='--write') out.write=true; else {
      const m=a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function buildFilterClause(terms){
  if (!terms) return { sql:'', params:[] };
  const arr=String(terms).split(',').map(s=>s.trim()).filter(Boolean);
  if (!arr.length) return { sql:'', params:[] };
  const conds=[]; const params=[];
  for (const t of arr){
    const p=`%${t}%`;
    conds.push(`a.name ILIKE $${params.length+1} OR ap.name ILIKE $${params.length+1}`);
    params.push(p);
  }
  return { sql:`WHERE ${conds.join(' OR ')}`, params };
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName){ console.error('Falta --db'); process.exit(1); }
  const method = (args.method||'').trim();
  if (!method){ console.error('Falta --method'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  try {
    // Confirmar columna method disponible
    const hasMethod = (await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='analysis_reference_ranges' AND column_name='method'")).rowCount>0;
    if (!hasMethod){ console.error('La columna method no existe en analysis_reference_ranges. Corre migraciones.'); process.exit(1); }
    const { sql, params } = buildFilterClause(args.terms || 'IGF-1,Metanefrina,Normetanefrina,Metanefrinas');
    const q = `
  SELECT a.name aname, ap.id pid, ap.name pname,
     COALESCE(ap.unit, a.general_units) unit,
     arr.id rid, arr.parameter_id, arr.sex, arr.age_min, arr.age_max, arr.lower, arr.upper, arr.text_value, arr.unit as runit, arr.method
      FROM analysis a
      JOIN analysis_parameters ap ON ap.analysis_id = a.id
      LEFT JOIN analysis_reference_ranges arr ON arr.parameter_id = ap.id
      ${sql}
      ORDER BY a.name, ap.position NULLS LAST, ap.name, arr.created_at
    `;
    const { rows } = await pool.query(q, params);
    const byParam = new Map();
    for (const r of rows){
      if (!byParam.has(r.pid)) byParam.set(r.pid, { aname:r.aname, pname:r.pname, unit:r.unit, rows:[] });
      byParam.get(r.pid).rows.push(r);
    }
    const actions=[];
    for (const p of byParam.values()){
      const existingMethod = new Set(p.rows.filter(r=>r.method && r.method.trim()).map(r=>r.method.trim().toLowerCase()));
      if (!existingMethod.has(method.toLowerCase())){
        // Tomar plantillas: todos los rangos sin method establecido
        const base = p.rows.filter(r=>!r.method || !r.method.trim());
        if (base.length){
          actions.push({ aname:p.aname, pname:p.pname, unit:p.unit, base });
        }
      }
    }
    if (!actions.length){ console.log('[METHOD] Nada que clonar.'); return; }
    console.log('Análisis\tParámetro\tUnidad\tClonaciones');
    for (const a of actions){
      const desc = a.base.map(b=>`[${b.sex||'Ambos'} ${b.age_min??0}–${b.age_max??120} ${b.text_value?('text:"'+b.text_value+'"'):(b.lower+'–'+b.upper)}]`).join(', ');
      console.log(`${a.aname}\t${a.pname}\t${a.unit||''}\t${desc}`);
    }
    if (args.write){
      let total=0;
      for (const a of actions){
        for (const b of a.base){
          await pool.query(
            `INSERT INTO analysis_reference_ranges(parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, text_value, unit, method)
             VALUES ($1,$2,$3,$4,'años',$5,$6,$7,$8,$9)`,
            [b.parameter_id || b.pid, b.sex || 'Ambos', b.age_min ?? null, b.age_max ?? null, b.lower ?? null, b.upper ?? null, b.text_value ?? null, b.runit || a.unit || null, method]
          );
          total++;
        }
      }
      console.log(`[METHOD] Insertadas ${total} filas con method='${method}'.`);
    } else {
      console.log('\n[METHOD] Dry-run: usa --write para aplicar.');
    }
  } finally { await pool.end(); }
}

if (require.main === module){
  main().catch(e=>{ console.error('[METHOD] Error:', e.message); process.exit(1); });
}

module.exports = {};
