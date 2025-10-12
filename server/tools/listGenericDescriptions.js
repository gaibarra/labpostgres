#!/usr/bin/env node
/**
 * listGenericDescriptions.js
 * Lista los estudios (analysis) cuya descripción es genérica o está vacía.
 * Uso:
 *   node server/tools/listGenericDescriptions.js [--db=lab_tenant] [--json]
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* optional */ }

function parseArgs(){
  const out = { json:false, db:null };
  for (const a of process.argv.slice(2)){
    const m=a.match(/^--([^=]+)(=(.*))?$/);
    if (!m) continue;
    const k=m[1]; const v=(m[3]!==undefined?m[3]:true);
    if (k==='json') out.json = String(v)!=='false';
    else if (k==='db') out.db = v;
  }
  return out;
}

async function hasTable(pool, name){
  const { rows } = await pool.query("SELECT to_regclass($1) t", [name.includes('.')?name:`public.${name}`]);
  return !!rows[0].t;
}
async function hasColumn(pool, table, column){
  const { rows } = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1",[table, column]);
  return !!rows[0];
}

async function main(){
  const args = parseArgs();
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: args.db || process.env.PGDATABASE
  });
  try {
    if (!await hasTable(pool,'analysis')) {
      console.error('[LIST] La tabla analysis no existe en esta base de datos.');
      process.exit(2);
    }
    const hasCode = await hasColumn(pool,'analysis','code');
    const q = `
      SELECT id, name, ${hasCode?'code,':''} COALESCE(category,'') AS category, description
      FROM analysis
      WHERE description IS NULL
         OR BTRIM(description) = ''
         OR BTRIM(description) ~* '^estudio de laboratorio cl[ií]nico\\.?$'
      ORDER BY LOWER(name)
    `;
    const { rows } = await pool.query(q);
    if (args.json) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      if (!rows.length) {
        console.log('[LIST] Todos los estudios tienen descripción no genérica.');
        return;
      }
      const cols = ['id','name'];
      if (hasCode) cols.push('code');
      cols.push('category');
      const lines = rows.map(r => cols.map(c => (r[c]??'')).join('\t'));
      console.log(cols.join('\t'));
      for (const ln of lines) console.log(ln);
      console.log(`\n[LIST] Total: ${rows.length}`);
    }
  } catch (e) {
    console.error('[LIST] Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) main();

module.exports = {};
