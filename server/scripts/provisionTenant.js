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
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
// Cargar .env (busca en root)
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { try { require('dotenv').config(); } catch(_) { /* ignore */ } }
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
    // Ejecutar migraciones SQL simples en scripts/migrations
    const fs = require('fs');
    const migDir = path.resolve(__dirname, 'migrations');
    if (fs.existsSync(migDir)) {
      const files = fs.readdirSync(migDir).filter(f=>/\.sql$/i.test(f)).sort();
      for (const f of files){
        const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
        if (sql.trim()) {
          try {
            await tenantPool.query(sql);
            console.log('[PROVISION] Migración aplicada', f);
          } catch(me){
            console.warn('[PROVISION] Falló migración %s: %s', f, me.message);
          }
        }
      }
    }
    // Esquema modular completo: si existen migraciones >=0003 asumimos que ya cubren el dominio extendido.
    // Conservamos el bloque legacy (setup.sql) sólo si no hay migraciones nuevas y el archivo existe y FORCE_SETUP=1.
    try {
      const fs = require('fs');
      const migDirFiles = fs.readdirSync(path.resolve(__dirname, 'migrations')).filter(f=>/^[0-9]{4}_.*\.sql$/.test(f));
      const hasExtended = migDirFiles.some(f => /^0003_/.test(f));
      const fullSetupPath = path.resolve(__dirname, '../../sql/setup.sql');
      if (!hasExtended && process.env.FORCE_SETUP === '1' && fs.existsSync(fullSetupPath)) {
        console.log('[PROVISION] Aplicando setup.sql (modo legacy, no se detectaron migraciones 0003+)');
        let raw = fs.readFileSync(fullSetupPath, 'utf8');
        raw = raw.replace(/CREATE\s+TABLE\s+(?!IF NOT EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
                 .replace(/CREATE\s+UNIQUE\s+INDEX\s+(?!IF NOT EXISTS)/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
                 .replace(/CREATE\s+INDEX\s+(?!IF NOT EXISTS)/gi, 'CREATE INDEX IF NOT EXISTS ');
        const statements = [];
        let buffer = '';
        let inDollar = false;
        for (const ln of raw.split(/\n/)) {
          if (/\$\$/.test(ln)) inDollar = !inDollar;
            buffer += ln + '\n';
            if (!inDollar && /;\s*$/.test(ln)) { statements.push(buffer); buffer=''; }
        }
        if (buffer.trim()) statements.push(buffer);
        for (const st of statements) {
          const trimmed = st.trim();
          if (!trimmed) continue;
          try { await tenantPool.query(trimmed); } catch(e) {
            if (!/(already exists|duplicate key|PG::DuplicateObject)/i.test(e.message)) {
              console.warn('[PROVISION] setup.sql stmt fallo:', e.message.split('\n')[0]);
            }
          }
        }
        console.log('[PROVISION] setup.sql aplicado (legacy)');
      } else if (!hasExtended) {
        console.log('[PROVISION] Migraciones extendidas (0003+) no presentes; puedes export FORCE_SETUP=1 para usar setup.sql');
      } else {
        console.log('[PROVISION] Esquema extendido provisto por migraciones (>=0003), no se usa setup.sql');
      }
    } catch(e) {
      console.warn('[PROVISION] Error evaluando esquema extendido:', e.message);
    }
    // Ejecutar seed de estudios canónicos
    try {
      const { seed } = require('./seedDefaultStudies');
      await seed(tenantPool);
    } catch (se) {
      console.warn('[PROVISION] Seed estudios falló:', se.message);
    }
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
