#!/usr/bin/env node
/**
 * runTenantMigrations.js
 * Ejecuta migraciones incrementales sobre cada base de datos tenant activa.
 * - Usa la tabla master.tenants (db_version) para saber qué migraciones faltan.
 * - Aplica archivos en sql/tenant_migrations con convención NNN_name.sql
 * - Tras cada migración exitosa incrementa db_version y registra evento.
 *
 * Seguridad / Concurrencia:
 * - Usa advisory lock por tenant (pg_advisory_xact_lock) para evitar dobles ejecuciones concurridas
 *   si corren dos instancias accidentalmente.
 * - Falla segura: si una migración da error, detiene ese tenant y pasa al siguiente; no incrementa versión.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function clean(val){
  if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1);
  return val;
}

const masterPool = new Pool({
  host: process.env.MASTER_PGHOST || process.env.PGHOST || '127.0.0.1',
  port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
  user: process.env.MASTER_PGUSER || process.env.PGUSER || 'postgres',
  password: clean(process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD || ''),
  database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master',
  max: 5
});

const MIGRATIONS_DIR = path.resolve(__dirname, '../../sql/tenant_migrations');

async function listMigrations(){
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{3}_.+\.sql$/.test(f))
    .sort();
}

async function applyMigrationToTenant(tenant, file){
  const full = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(full, 'utf8');
  const tenantPool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST || '127.0.0.1',
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER || 'postgres',
    password: clean(process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD || ''),
    database: tenant.db_name,
    max: 3
  });
  const client = await tenantPool.connect();
  try {
    await client.query('BEGIN');
    // advisory lock (usa hash por tenant id)
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(BigInt('0x' + tenant.id.replace(/-/g,'')) % BigInt(2147483647))]);
    await client.query(sql);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    throw e;
  } finally {
    client.release();
    await tenantPool.end();
  }
}

async function recordEvent(tenantId, type, meta){
  await masterPool.query('INSERT INTO tenant_events(tenant_id, event_type, meta) VALUES($1,$2,$3)', [tenantId, type, meta ? JSON.stringify(meta) : null]);
}

async function run(){
  const files = await listMigrations();
  if (!files.length) {
    console.log('[MIGR] No hay migraciones en', MIGRATIONS_DIR);
    return;
  }
  const { rows: tenants } = await masterPool.query('SELECT id, db_name, db_version FROM tenants WHERE status = $1 ORDER BY created_at', ['active']);
  if (!tenants.length) {
    console.log('[MIGR] No hay tenants activos. Fin.');
    return;
  }
  console.log(`[MIGR] Tenants activos: ${tenants.length}`);
  for (const t of tenants) {
    let currentVersion = t.db_version || 0;
    const pending = files.filter(f => parseInt(f.slice(0,3),10) > currentVersion);
    if (!pending.length) {
      console.log(`[MIGR][${t.db_name}] al día (v${currentVersion})`);
      continue;
    }
    console.log(`[MIGR][${t.db_name}] aplicando ${pending.length} migraciones (desde v${currentVersion})`);
    for (const file of pending) {
      const targetVer = parseInt(file.slice(0,3),10);
      try {
        await applyMigrationToTenant(t, file);
        await masterPool.query('UPDATE tenants SET db_version=$1 WHERE id=$2', [targetVer, t.id]);
        await recordEvent(t.id, 'migration_applied', { file, new_version: targetVer });
        currentVersion = targetVer;
        console.log(`[MIGR][${t.db_name}] aplicada ${file} -> v${targetVer}`);
      } catch (e) {
        console.error(`[MIGR][${t.db_name}] ERROR en ${file}:`, e.message);
        await recordEvent(t.id, 'migration_error', { file, error: e.message });
        break; // no continuar siguientes para este tenant
      }
    }
  }
}

run().catch(e => { console.error('[MIGR] FATAL', e); process.exit(1); }).finally(()=> masterPool.end());
