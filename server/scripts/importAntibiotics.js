#!/usr/bin/env node
/**
 * importAntibiotics.js
 * Simple importer/updater for the antibiotics catalog from a JSON file.
 * Usage:
 *   node server/scripts/importAntibiotics.js --db=lab_tenant --file=./antibiotics.json
 * JSON format: [ { code, name, class, is_active, synonyms } ]
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* ignore missing .env */ }

function parseArgs(){
  const out={};
  process.argv.slice(2).forEach(a=>{ const m=a.match(/^--([^=]+)=(.*)$/); if(m) out[m[1]]=m[2]; });
  return out;
}

async function run(){
  const args = parseArgs();
  const file = args.file || args.f;
  if (!file) { console.error('Debe pasar --file=path.json'); process.exit(1); }
  const dbName = args.db || process.env.PGDATABASE;
  if (!dbName) { console.error('Debe pasar --db=nombre_db o configurar PGDATABASE'); process.exit(1); }
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  let items;
  try { items = JSON.parse(raw); } catch (e) { console.error('Archivo JSON inválido:', e.message); process.exit(1); }
  if (!Array.isArray(items)) { console.error('El JSON debe ser un arreglo de antibióticos'); process.exit(1); }

  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST || '127.0.0.1',
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName
  });
  try {
    const { rows } = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='antibiotics'`);
    if (!rows.length) { console.error('La tabla antibiotics no existe en la BD. Ejecute la migración correspondiente.'); process.exit(1); }
    let upserts = 0;
    await pool.query('BEGIN');
    try {
      for (const it of items) {
        const code = String(it.code || '').trim();
        const name = String(it.name || '').trim();
        if (!code || !name) { console.warn('[SKIP] Fila sin code o name:', it); continue; }
        const cls = it.class == null ? null : String(it.class).trim();
        const isActive = typeof it.is_active === 'boolean' ? it.is_active : true;
        const synonyms = Array.isArray(it.synonyms) ? it.synonyms : null;
        await pool.query(
          `INSERT INTO antibiotics(code,name,class,is_active,synonyms)
           VALUES($1,$2,$3,$4,$5)
           ON CONFLICT (code) DO UPDATE SET
             name = EXCLUDED.name,
             class = EXCLUDED.class,
             is_active = EXCLUDED.is_active,
             synonyms = EXCLUDED.synonyms`,
          [code, name, cls, isActive, synonyms]
        );
        upserts++;
      }
      await pool.query('COMMIT');
      console.log(`[IMPORT] Catálogo actualizado: ${upserts} upserts`);
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('[IMPORT][ERROR]', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) run();
