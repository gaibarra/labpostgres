#!/usr/bin/env node
// Audita todos los tenants activos y reporta si tienen la columna `position`
// en `analysis_package_items` y el constraint único `(package_id, position)`.
require('dotenv').config();
const { Pool } = require('pg');

async function auditTenant(dbName, cfg) {
  const pool = new Pool({ ...cfg, database: dbName, max: 2, idleTimeoutMillis: 30000 });
  try {
    const resTable = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='analysis_package_items'
       ) AS exists`
    );
    const hasTable = resTable.rows[0]?.exists === true;
    if (!hasTable) {
      return { hasTable: false, hasPosition: false, hasUnique: false, hasIndex: false };
    }

    const resCol = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='analysis_package_items' AND column_name='position'
       ) AS exists`
    );
    const hasPosition = resCol.rows[0]?.exists === true;

    const resUnique = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname='public' AND t.relname='analysis_package_items'
           AND c.contype='u' AND c.conname='uq_analysis_package_items_package_pos'
       ) AS exists`
    );
    const hasUnique = resUnique.rows[0]?.exists === true;

    const resIndex = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname='public' AND tablename='analysis_package_items'
           AND indexname='idx_analysis_package_items_package_pos'
       ) AS exists`
    );
    const hasIndex = resIndex.rows[0]?.exists === true;

    return { hasTable, hasPosition, hasUnique, hasIndex };
  } finally {
    await pool.end();
  }
}

async function main(){
  // Pool a master para listar tenants
  const masterCfg = {
    host: process.env.MASTER_PGHOST || process.env.PGHOST || '127.0.0.1',
    port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
    user: process.env.MASTER_PGUSER || process.env.PGUSER,
    password: process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD,
    database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master',
    max: 5,
    idleTimeoutMillis: 30000
  };
  const tenantCfg = {
    host: process.env.TENANT_PGHOST || process.env.PGHOST || '127.0.0.1',
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD
  };

  const masterPool = new Pool(masterCfg);
  let tenants = [];
  try {
    const { rows } = await masterPool.query("SELECT id, slug, db_name, status FROM tenants WHERE status='active'");
    tenants = rows;
  } catch (e) {
    console.error('[auditPackagesPositionAllTenants] Error consultando tenants en master:', e.message);
    await masterPool.end();
    process.exit(1);
  }

  console.log(`[auditPackagesPositionAllTenants] Tenants activos: ${tenants.length}`);
  const results = [];
  for (const t of tenants) {
    process.stdout.write(` - ${t.slug} (${t.db_name}) ... `);
    try {
      const r = await auditTenant(t.db_name, tenantCfg);
      results.push({ slug: t.slug, db: t.db_name, ...r });
      console.log('OK');
    } catch (e) {
      results.push({ slug: t.slug, db: t.db_name, error: e.message });
      console.log('FAIL');
      console.error(`   > ${e.message}`);
    }
  }

  await masterPool.end();

  // Resumen
  const summary = {
    total: results.length,
    ok: results.filter(r => r.hasTable && r.hasPosition && r.hasUnique && r.hasIndex).length,
    missingPosition: results.filter(r => r.hasTable && !r.hasPosition).map(r => r.slug),
    missingUnique: results.filter(r => r.hasTable && !r.hasUnique).map(r => r.slug),
    missingIndex: results.filter(r => r.hasTable && !r.hasIndex).map(r => r.slug),
    missingTable: results.filter(r => r.hasTable === false).map(r => r.slug),
    errors: results.filter(r => r.error)
  };

  console.log('\n[auditPackagesPositionAllTenants] Resultado por tenant:');
  for (const r of results) {
    if (r.error) {
      console.log(`   ${r.slug}: ERROR - ${r.error}`);
    } else {
      console.log(`   ${r.slug}: table=${r.hasTable} position=${r.hasPosition} unique=${r.hasUnique} index=${r.hasIndex}`);
    }
  }

  console.log('\n[auditPackagesPositionAllTenants] Resumen:');
  console.log(JSON.stringify(summary, null, 2));

  // Salir con 0 para que esto no bloquee pipelines; es una auditoría
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
