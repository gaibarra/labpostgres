#!/usr/bin/env node
/**
 * tenant-diagnostics.js
 * Verifica estado de un tenant: tablas claves, columnas críticas y conteos básicos.
 * Uso: node server/tools/tenant-diagnostics.js --db=lab_demo
 */
const { Pool } = require('pg');
const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (e) {
  // .env opcional para diagnósticos; se ignora si no existe o falla la carga
  if (process.env.DEBUG_ENV === '1') {
    console.warn('[tenant-diagnostics] .env no cargado:', e.message);
  }
}

function parseArgs(){
  const out={};
  for (const a of process.argv.slice(2)){
    const m=a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]]=m[2];
  }
  return out;
}

async function main(){
  const { db } = parseArgs();
  if (!db) { console.error('Falta --db=nombre_db'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: db
  });
  console.log('[DIAG][%s] Inicio', db);
  const q = async (label, sql, params=[])=>{
    try {
      const { rows } = await pool.query(sql, params);
      return { ok:true, rows };
    } catch(e){ return { ok:false, error:e.message }; }
  };
  const requiredTables = ['analysis','analysis_parameters','reference_ranges','analysis_reference_ranges','profiles','work_orders'];
  const tablesRes = await q('tables',`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  const existing = new Set((tablesRes.rows||[]).map(r=>r.table_name));
  const missing = requiredTables.filter(t=>!existing.has(t));

  // Column checks for analysis
  const colCheck = async (table, cols)=>{
    const res = await q('cols',`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
    const have = new Set(res.rows.map(r=>r.column_name));
    return cols.map(c=>({ column:c, present: have.has(c) }));
  };
  const analysisCols = await colCheck('analysis',['id','name','created_at','price','general_units']);
  const paramCols = await colCheck('analysis_parameters',['id','analysis_id','name','unit','position']);

  // Counts
  const counts = {};
  for (const t of ['analysis','analysis_parameters','reference_ranges','analysis_reference_ranges']){
    if (existing.has(t)) {
      const r = await q('count',`SELECT COUNT(*)::int AS c FROM ${t}`);
      counts[t] = r.ok ? r.rows[0].c : null;
    }
  }

  // Sample select failure reproduction (query used in listing)
  let listAttempt = null;
  if (existing.has('analysis')) {
    listAttempt = await q('list','SELECT id,name,created_at FROM analysis ORDER BY created_at DESC LIMIT 1');
  }

  console.log(JSON.stringify({
    db,
    existingTables: Array.from(existing).sort(),
    missingTables: missing,
    analysisCols,
    paramCols,
    counts,
    listAttempt,
    ts: Date.now()
  }, null, 2));
  await pool.end();
}

main().catch(e=>{ console.error('[DIAG][FATAL]', e); process.exit(1); });
