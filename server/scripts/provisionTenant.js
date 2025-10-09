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
  const { slug, email, password, plan='standard', verify='1', autofix='1' } = parseArgs();
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
    // Semilla de catálogo de antibióticos (si tabla existe) para soporte de Antibiograma
    try {
      const { seedAntibiotics } = require('./seedAntibiotics');
      await seedAntibiotics(dbName);
    } catch (abErr) {
      console.warn('[PROVISION] Semilla de antibióticos no aplicada:', abErr.message);
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
    // Ejecutar migraciones multi-tenant centralizadas si existen (sql/tenant_migrations)
    try {
      const { execSync } = require('child_process');
      const runScript = path.resolve(__dirname, 'runTenantMigrations.js');
      if (fs.existsSync(path.resolve(__dirname, '../../sql/tenant_migrations'))) {
        console.log('[PROVISION] Ejecutando migraciones de tenant centralizadas');
        execSync(`node ${runScript}`, { stdio: 'inherit' });
      }
    } catch (e) {
      console.warn('[PROVISION] runTenantMigrations fallo o no disponible:', e.message);
    }

    // Ejecutar seed de estudios canónicos
    try {
      const { seed } = require('./seedDefaultStudies');
      await seed(tenantPool);
    } catch (se) {
      console.warn('[PROVISION] Seed estudios falló:', se.message);
    }

    // Backfill de metadatos en analysis para garantizar que los 14 estudios queden completos
    try {
      const fs2 = require('fs');
      const sqlBackfill = fs2.readFileSync(path.resolve(__dirname, '../../sql/tenant_migrations/011_add_analysis_metadata.sql'), 'utf8');
      if (sqlBackfill && /analysis/i.test(sqlBackfill)) {
        await tenantPool.query(sqlBackfill);
        console.log('[PROVISION] Backfill metadatos analysis aplicado');
      }
    } catch (bfErr) {
      console.warn('[PROVISION] No se pudo aplicar backfill de metadatos:', bfErr.message);
    }

    // Backfill cualitativo: asegurar rango texto por defecto en parámetros sin rangos
    try {
      const { applyToDb: backfillQualitative } = require('./backfillQualitativeRanges');
      await backfillQualitative(dbName);
      console.log('[PROVISION] Backfill rangos cualitativos aplicado');
    } catch (qErr) {
      console.warn('[PROVISION] No se pudo aplicar backfill cualitativo:', qErr.message);
    }

    // Verificación rápida de metadatos en analysis (diaria, no bloqueante)
    try {
  const { rows: check } = await tenantPool.query(`SELECT name, code, category, description, indications, sample_type, sample_container, processing_time_hours FROM analysis ORDER BY created_at DESC LIMIT 20`);
  const missing = check.filter(r => !r.description || !r.sample_type || !r.sample_container || r.processing_time_hours === null || r.processing_time_hours === undefined);
      console.log('[PROVISION][VERIFY] Estudios con metadatos faltantes:', missing.length);
    } catch (verr) {
      console.warn('[PROVISION][VERIFY] No se pudo verificar metadatos:', verr.message);
    }
    // Paso de consolidación final: asegurar columnas críticas de work_orders para evitar primer-uso sin persistencia.
    try {
      await tenantPool.query(`DO $$BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='work_orders' AND table_schema='public') THEN
          -- results jsonb
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='results') THEN
            ALTER TABLE work_orders ADD COLUMN results jsonb;
          END IF;
          -- validation_notes text
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='validation_notes') THEN
            ALTER TABLE work_orders ADD COLUMN validation_notes text;
          END IF;
          -- institution_reference text (puede que no esté en migraciones antiguas)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='institution_reference') THEN
            ALTER TABLE work_orders ADD COLUMN institution_reference text;
          END IF;
          -- Subtotales y campos financieros (por si se creó antes de consolidación)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='subtotal') THEN
            ALTER TABLE work_orders ADD COLUMN subtotal numeric(12,2);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='descuento') THEN
            ALTER TABLE work_orders ADD COLUMN descuento numeric(12,2);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='anticipo') THEN
            ALTER TABLE work_orders ADD COLUMN anticipo numeric(12,2);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='notas') THEN
            ALTER TABLE work_orders ADD COLUMN notas text;
          END IF;
        END IF;
      END$$;`);
      console.log('[PROVISION] Consolidación work_orders columnas verificada');
    } catch (ccErr) {
      console.warn('[PROVISION] Consolidación work_orders falló:', ccErr.message);
    }
    // Asegurar columnas adicionales que pueden faltar en work_orders (results_finalized, receipt_generated)
    try {
      await tenantPool.query(`DO $$BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='work_orders' AND table_schema='public') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='results_finalized') THEN
            ALTER TABLE work_orders ADD COLUMN results_finalized boolean DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_orders' AND column_name='receipt_generated') THEN
            ALTER TABLE work_orders ADD COLUMN receipt_generated boolean DEFAULT false;
          END IF;
        END IF;
      END$$;`);
      console.log('[PROVISION] work_orders columnas extendidas verificadas');
    } catch(e){ console.warn('[PROVISION] No se pudieron asegurar columnas extendidas work_orders:', e.message); }

    // Crear tabla de auditoría proactivamente (soporta esquema legacy con columna 'timestamp')
    try {
      await tenantPool.query(`CREATE TABLE IF NOT EXISTS system_audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        action text NOT NULL,
        details jsonb,
        performed_by uuid
      );`);
      // Asegurar columnas opcionales
      await tenantPool.query(`DO $$BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_audit_logs' AND column_name='entity') THEN
          ALTER TABLE system_audit_logs ADD COLUMN entity text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_audit_logs' AND column_name='entity_id') THEN
          ALTER TABLE system_audit_logs ADD COLUMN entity_id text;
        END IF;
        -- Normalizar created_at: si existe 'timestamp' y falta 'created_at', renombrar
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_audit_logs' AND column_name='timestamp')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_audit_logs' AND column_name='created_at') THEN
          ALTER TABLE system_audit_logs RENAME COLUMN "timestamp" TO created_at;
        END IF;
        -- Si no existe ninguna, añadir created_at
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_audit_logs' AND column_name='created_at') THEN
          ALTER TABLE system_audit_logs ADD COLUMN created_at timestamptz DEFAULT now();
        END IF;
      END$$;`);
      await tenantPool.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON system_audit_logs(action);`);
      await tenantPool.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON system_audit_logs(created_at DESC);`);
      await tenantPool.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON system_audit_logs(entity);`);
      console.log('[PROVISION] Auditoría lista');
    } catch(e){ console.warn('[PROVISION] Auditoría no pudo inicializarse:', e.message); }

    const ensureRolesAndPerms = async () => {
      const expected = {
        Administrador: ['create','read_all','enter_results','update_status','validate_results','print_report','send_report'],
        Laboratorista: ['read_all','enter_results','update_status'],
        Recepcionista: ['create','read_all','update_status','print_report','send_report']
      };
      const res = await tenantPool.query('SELECT role_name, permissions FROM roles_permissions');
      const present = new Map(res.rows.map(r=>[r.role_name, r.permissions || {}]));
      const summary = [];
      for (const [role, needed] of Object.entries(expected)) {
        let changed = false;
        if (!present.has(role)) {
          if (autofix === '1') {
            await tenantPool.query('INSERT INTO roles(role_name,label,color_class) VALUES($1,$2,$3) ON CONFLICT (role_name) DO NOTHING', [role, role, 'bg-slate-100 text-slate-800']);
            await tenantPool.query('INSERT INTO roles_permissions(role_name, permissions, is_system_role) VALUES($1,$2,true) ON CONFLICT (role_name) DO NOTHING', [role, { orders: needed, patients: ['read'] }]);
            changed = true;
          }
          summary.push({ role, status: changed ? 'created' : 'missing_created_disabled', missing: needed });
          continue;
        }
        const perms = present.get(role);
        const currentOrders = Array.isArray(perms.orders) ? perms.orders.slice() : [];
        const missing = needed.filter(p=>!currentOrders.includes(p));
        if (missing.length && autofix === '1') {
          const merged = Array.from(new Set([...currentOrders, ...missing]));
            perms.orders = merged;
            await tenantPool.query('UPDATE roles_permissions SET permissions=$2 WHERE role_name=$1', [role, perms]);
            changed = true;
        }
        summary.push({ role, status: changed ? 'patched' : 'ok', missing: missing.filter(m=>!currentOrders.includes(m)) });
      }
      return summary;
    };

    let verificationReport = null;
    if (verify === '1') {
      try {
        const columnsCheck = await tenantPool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='work_orders'`);
        const cols = columnsCheck.rows.map(r=>r.column_name);
        const requiredCols = ['results','validation_notes','institution_reference','results_finalized','receipt_generated'];
        const missingCols = requiredCols.filter(c=>!cols.includes(c));
        const rolesReport = await ensureRolesAndPerms();
        verificationReport = { missingCols, rolesReport };
        if (missingCols.length) {
          console.warn('[PROVISION][VERIFY] Columnas faltantes:', missingCols.join(','));
        }
        console.log('[PROVISION][VERIFY] Reporte:', JSON.stringify(verificationReport));
      } catch(e){ console.warn('[PROVISION][VERIFY] Error verificación:', e.message); }
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
