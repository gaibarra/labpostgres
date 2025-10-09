#!/usr/bin/env node
/**
 * backfillAnalysisMetadata.js
 * Rellena metadatos clínicos en la tabla analysis para tenants existentes.
 * Usa coincidencia por nombre de estudio del seed canónico. Idempotente.
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_e) { /* .env optional */ }

function clean(val){
  if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1);
  return val;
}

const MIG_FILE = path.resolve(__dirname, '../../sql/tenant_migrations/011_add_analysis_metadata.sql');

async function applyToDb(dbName){
  const fs = require('fs');
  const sql = fs.readFileSync(MIG_FILE, 'utf8');
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: clean(process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
    database: dbName
  });
  try {
    await pool.query(sql);
    console.log('[BACKFILL] OK en', dbName);
  } catch (e) {
    console.error('[BACKFILL] Error en', dbName, e.message);
  } finally {
    await pool.end();
  }
}

async function main(){
  const { Pool } = require('pg');
  const master = new Pool({
    host: process.env.MASTER_PGHOST || process.env.PGHOST,
    port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
    user: process.env.MASTER_PGUSER || process.env.PGUSER,
    password: clean(process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD),
    database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master'
  });
  try {
    const { rows } = await master.query('SELECT db_name FROM tenants WHERE status=$1', ['active']);
    for (const r of rows) await applyToDb(r.db_name);
  } finally {
    await master.end();
  }
}

if (require.main === module) main();

module.exports = { applyToDb };
