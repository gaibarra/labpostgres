#!/usr/bin/env node
// Applies sql/20251108_add_position_to_analysis_package_items.sql to ALL active tenants
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main(){
  const sqlPath = path.resolve(__dirname, '../../sql/20251108_add_position_to_analysis_package_items.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('[migratePackagesPositionAllTenants] Archivo SQL no encontrado:', sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Master pool (lista tenants)
  const masterPool = new Pool({
    host: process.env.MASTER_PGHOST || process.env.PGHOST || '127.0.0.1',
    port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
    user: process.env.MASTER_PGUSER || process.env.PGUSER,
    password: process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD,
    database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master',
    max: 5,
    idleTimeoutMillis: 30000
  });

  let tenants = [];
  try {
    const { rows } = await masterPool.query("SELECT id, slug, db_name, status FROM tenants WHERE status='active'");
    tenants = rows;
  } catch (e) {
    console.error('[migratePackagesPositionAllTenants] Error consultando tenants en master:', e.message);
    await masterPool.end();
    process.exit(1);
  }

  console.log(`[migratePackagesPositionAllTenants] Tenants activos a migrar: ${tenants.length}`);

  let ok = 0, fail = 0;
  for (const t of tenants) {
    const pool = new Pool({
      host: process.env.TENANT_PGHOST || process.env.PGHOST || '127.0.0.1',
      port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
      user: process.env.TENANT_PGUSER || process.env.PGUSER,
      password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
      database: t.db_name,
      max: 2,
      idleTimeoutMillis: 30000
    });
    process.stdout.write(` - ${t.slug} (${t.db_name}) ... `);
    try {
      await pool.query(sql);
      console.log('OK');
      ok++;
    } catch (e) {
      console.log('FAIL');
      console.error(`   > ${e.message}`);
      fail++;
    } finally {
      await pool.end();
    }
  }

  await masterPool.end();
  console.log(`[migratePackagesPositionAllTenants] Finalizado. OK=${ok} FAIL=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
