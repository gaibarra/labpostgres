#!/usr/bin/env node
/**
 * provisionTenant.js
 * Crea una base de datos para un nuevo laboratorio (tenant), aplica migraciones iniciales
 * y lo registra en la DB master.
 * Requisitos:
 *  - Variables MASTER_PG* configuradas para acceder al master.
 *  - Permisos para crear DB (PGUSER debe ser superuser o rol con CREATEDB) o usar un usuario admin separado.
 * Uso:
 *  node server/scripts/provisionTenant.js --slug=labdemo --email=admin@demo.com --password='Secret123' [--plan=premium]
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
// Cargar .env (busca en root)
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { try { require('dotenv').config(); } catch(_) {} }
function clean(val){
  if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1); // remove surrounding single quotes
  return val;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main(){
  const { slug, email, password, plan='standard' } = parseArgs();
  if (!slug || !email || !password) {
    console.error('Faltan argumentos. Ejemplo: --slug=labdemo --email=admin@demo.com --password="Secret123"');
    process.exit(1);
  }
  const dbName = `lab_${slug.replace(/[^a-z0-9_]/gi,'').toLowerCase()}`;
  const masterPool = new Pool({
    host: process.env.MASTER_PGHOST || process.env.PGHOST,
    port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
    user: process.env.MASTER_PGUSER || process.env.PGUSER,
    password: clean(process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD),
    database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master'
  });
  console.log('[PROVISION] Registrando tenant slug=%s db=%s', slug, dbName);
  // 1. Crear DB
  try {
    execSync(`createdb ${dbName}`, { stdio: 'inherit' });
  } catch (e) {
    const msg = String(e.message || '');
    if (/already exists/i.test(msg) || /exists, skipping/i.test(msg)) {
      console.log('[PROVISION] DB ya existía, continuando');
    } else {
      console.error('[PROVISION] Advertencia: no se pudo crear DB (puede existir o falta permiso):', msg.split('\n')[0]);
    }
  }
  // 2. Migraciones iniciales (placeholder). Aquí podrías invocar un script de migraciones tenant.
  //    Por ahora sólo crea una tabla marker.
  try {
    const tenantPool = new Pool({
      host: process.env.TENANT_PGHOST || process.env.PGHOST,
      port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
      user: process.env.TENANT_PGUSER || process.env.PGUSER,
      password: clean(process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
      database: dbName
    });
    await tenantPool.query('CREATE TABLE IF NOT EXISTS _tenant_bootstrap (installed_at timestamptz DEFAULT now())');
    await tenantPool.end();
  } catch (e) {
    console.error('[PROVISION] Error aplicando migraciones iniciales:', e.message);
    process.exit(1);
  }
  // 3. Registrar en master (tenants + tenant_admins)
  const pwHash = await bcrypt.hash(password, 10);
  try {
    await masterPool.query('BEGIN');
    const tRes = await masterPool.query('INSERT INTO tenants(slug, db_name, plan) VALUES($1,$2,$3) ON CONFLICT (slug) DO UPDATE SET plan=EXCLUDED.plan RETURNING id', [slug, dbName, plan]);
    const tenantId = tRes.rows[0].id;
    await masterPool.query('INSERT INTO tenant_admins(tenant_id, email, password_hash, role) VALUES($1,$2,$3,$4) ON CONFLICT (tenant_id, email) DO NOTHING', [tenantId, email, pwHash, 'owner']);
    await masterPool.query('INSERT INTO tenant_events(tenant_id, event_type, meta) VALUES($1,$2,$3)', [tenantId, 'provisioned', JSON.stringify({ slug, dbName })]);
    await masterPool.query('COMMIT');
    console.log('[PROVISION] Listo. tenant_id=%s', tenantId);
  } catch (e) {
    await masterPool.query('ROLLBACK');
    console.error('[PROVISION] Error registrando tenant en master:', e.message);
    process.exit(1);
  } finally {
    await masterPool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
