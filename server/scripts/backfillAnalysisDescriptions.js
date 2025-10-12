#!/usr/bin/env node
/**
 * backfillAnalysisDescriptions.js
 * Itera tenants activos en master y aplica applyAnalysisDescriptions.js en cada uno.
 */
const path = require('path');
const { Pool } = require('pg');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* ignore */ }

function clean(val){
  if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1);
  return val;
}

async function main(){
  const masterPool = new Pool({
    host: process.env.MASTER_PGHOST || process.env.PGHOST,
    port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
    user: process.env.MASTER_PGUSER || process.env.PGUSER,
    password: clean(process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD),
    database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master'
  });
  try {
    const { rows } = await masterPool.query('SELECT db_name FROM tenants WHERE status=$1', ['active']);
    for (const r of rows){
      try {
        const childEnv = {
          ...process.env,
          PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
          PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
          PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
          PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
          PGDATABASE: r.db_name
        };
        require('child_process').execSync(`node ${path.resolve(__dirname,'applyAnalysisDescriptions.js')}`, { stdio: 'inherit', env: childEnv });
        console.log('[BACKFILL-DESC] Aplicado en', r.db_name);
      } catch(e){
        console.warn('[BACKFILL-DESC] Falló en %s: %s', r.db_name, e.message);
      }
    }
  } finally {
    await masterPool.end();
  }
}

if (require.main === module) main();
