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
  // 1. Crear DB si no existe; marcar si es nueva para condicionar el enforcer
  let isNewDb = false;
  try {
    const { rows: dbRows } = await masterPool.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
    const exists = dbRows && dbRows.length > 0;
    if (!exists) {
      try {
        execSync(`createdb ${dbName}`, { stdio: 'inherit' });
        isNewDb = true;
        console.log('[PROVISION] DB creada');
      } catch (e) {
        const msg = String(e.message || '');
        if (/already exists/i.test(msg) || /exists, skipping/i.test(msg)) {
          console.log('[PROVISION] DB ya existía, continuando');
        } else {
          console.error('[PROVISION] Advertencia: no se pudo crear DB (puede existir o falta permiso):', msg.split('\n')[0]);
        }
      }
    } else {
      console.log('[PROVISION] DB ya existía, continuando');
    }
  } catch (chkErr) {
    console.warn('[PROVISION] No se pudo verificar existencia de DB, intentando createdb de todos modos:', chkErr.message);
    try { execSync(`createdb ${dbName}`, { stdio: 'inherit' }); isNewDb = true; } catch(createErr) {
      console.warn('[PROVISION] createdb falló (puede existir o falta permiso):', (createErr && createErr.message || '').split('\n')[0]);
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
    // Ejecutar migraciones multi-tenant SOLO para este nuevo tenant (sql/tenant_migrations)
    // Evita depender del estado 'active' en master o de ejecuciones globales.
    try {
      const tenantMigDir = path.resolve(__dirname, '../../sql/tenant_migrations');
      if (fs.existsSync(tenantMigDir)) {
        const migFiles = fs.readdirSync(tenantMigDir)
          .filter(f => /^\d{3}_.+\.sql$/.test(f))
          .sort();
        for (const f of migFiles) {
          const ver = parseInt(f.slice(0,3), 10) || 0;
          const sql = fs.readFileSync(path.join(tenantMigDir, f), 'utf8');
          try {
            await tenantPool.query('BEGIN');
            await tenantPool.query(sql);
            await tenantPool.query('COMMIT');
            console.log('[PROVISION][TENANT-MIG] aplicada %s -> v%d', f, ver);
          } catch (e) {
            await tenantPool.query('ROLLBACK').catch(()=>{});
            console.error('[PROVISION][TENANT-MIG] ERROR en %s: %s', f, e.message);
            throw e;
          }
        }
      } else {
        console.log('[PROVISION] No hay directorio de migraciones tenant (%s)', tenantMigDir);
      }
    } catch (e) {
      console.warn('[PROVISION] Migraciones por-tenant fallaron:', e.message);
    }

    // Ejecutar seed de estudios canónicos
    try {
      const { seed } = require('./seedDefaultStudies');
      await seed(tenantPool);
    } catch (se) {
      console.warn('[PROVISION] Seed estudios falló:', se.message);
    }

    // Semilla de estudios sueltos (1 parámetro o pocos) desde JSON si está presente
    try {
      const { seedFromFile } = require('./seedSingleParameterStudies');
      await seedFromFile(dbName);
      console.log('[PROVISION] Semilla de estudios sueltos ejecutada (si hay archivo JSON)');
    } catch (se2) {
      console.warn('[PROVISION] Semilla de estudios sueltos no aplicada:', se2.message);
    }

    // Auto-fix cuantitativo con plantillas: volver a ejecutar seeder para reemplazar cualitativos
    try {
      if (String(autofix) === '1') {
        const { execSync } = require('child_process');
        execSync(`node ${path.resolve(__dirname, 'seedSingleParameterStudies.js')} --db=${dbName}`, { stdio: 'inherit' });
        console.log('[PROVISION] Auto-fix de rangos con plantillas aplicado');
      }
    } catch (afErr) {
      console.warn('[PROVISION] Auto-fix de plantillas falló:', afErr.message);
    }

    // Migración ligera: agregar columna 'method' a reference_ranges modernos/legacy
    try {
      const fs2 = require('fs');
      const migPath = path.resolve(__dirname, '../../sql/20251010_add_method_to_reference_ranges.sql');
      if (fs2.existsSync(migPath)) {
        await tenantPool.query(fs2.readFileSync(migPath, 'utf8'));
        console.log('[PROVISION] Columna method en reference ranges verificada');
      }
    } catch (mErr) {
      console.warn('[PROVISION] No se pudo aplicar columna method:', mErr.message);
    }

  // Nota: se eliminó la sincronización específica de paneles.

    // Backfill método-dependiente: IGF-1 y metanefrinas (duplica rangos sin método a LC-MS/MS e Inmunoensayo)
    try {
      const { execSync } = require('child_process');
      execSync(`node ${path.resolve(__dirname, 'backfillMethodSpecificRanges.js')} --db=${dbName} --like="%IGF-1%|%Metanefrina%|%Normetanefrina%" --write`, { stdio: 'inherit' });
    } catch (bfm) {
      console.warn('[PROVISION] Backfill método-dependiente no aplicado:', bfm.message);
    }

    // Backfill de gaps 0–120 años en rangos (copiar valores adyacentes)
    try {
      const { execSync } = require('child_process');
      execSync(`node ${path.resolve(__dirname, 'backfillRangeGaps.js')} --db=${dbName} --write`, { stdio: 'inherit' });
    } catch (gapsErr) {
      console.warn('[PROVISION] Backfill de gaps no aplicado:', gapsErr.message);
    }

    // Split por sexo desde "Ambos" para analitos con alta probabilidad de diferencia por sexo
    // Lista curada: PSA y variantes; evitar hormonales (lo cubre enforceAdultSexPairs)
    try {
      const { execSync } = require('child_process');
      const like = '%PSA%|%Antígeno prostático%|%Pro-PSA%|%p2PSA%|%Índice de salud prostática%|%PHI%';
      execSync(`node ${path.resolve(__dirname, 'splitSexFromAmbos.js')} --db=${dbName} --like "${like}" --write`, { stdio: 'inherit' });
    } catch (sexErr) {
      console.warn('[PROVISION] Split por sexo no aplicado:', sexErr.message);
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

    // Defaults globales de metadatos para cualquier estudio faltante (post-seeds)
    try {
      const fs2 = require('fs');
      const sqlDefaults = fs2.readFileSync(path.resolve(__dirname, '../../sql/tenant_migrations/012_fill_analysis_metadata_defaults.sql'), 'utf8');
      if (sqlDefaults && /analysis/i.test(sqlDefaults)) {
        await tenantPool.query(sqlDefaults);
        console.log('[PROVISION] Defaults de metadatos analysis aplicados');
      }
    } catch (bf2Err) {
      console.warn('[PROVISION] No se pudieron aplicar defaults de metadatos:', bf2Err.message);
    }

    // Aplicar descripciones por estudio (mapeo específico)
    try {
      const { execSync } = require('child_process');
      const script = path.resolve(__dirname, 'applyAnalysisDescriptions.js');
      const childEnv = {
        ...process.env,
        PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
        PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
        PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
        PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
        PGDATABASE: dbName
      };
      execSync(`node ${script}`, { stdio: 'inherit', env: childEnv });
      console.log('[PROVISION] Descripciones por estudio aplicadas');
    } catch (descErr) {
      console.warn('[PROVISION] No se pudieron aplicar descripciones por estudio:', descErr.message);
    }

    // Backfill de categorías profesionales en analysis (usa el mismo algoritmo local)
    try {
      const childEnvCat = {
        ...process.env,
        PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
        PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
        PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
        PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
        PGDATABASE: dbName,
      };
      const applyScript = path.resolve(__dirname, 'applyAnalysisCategories.js');
      require('child_process').execSync(`node ${applyScript} --apply`, { stdio: 'inherit', env: childEnvCat });
      console.log('[PROVISION] Categorías de analysis aplicadas');
    } catch (catErr) {
      console.warn('[PROVISION] Backfill de categorías no aplicado:', catErr.message);
    }

    // Backfill cualitativo: asegurar rango texto por defecto en parámetros sin rangos
    try {
      const { applyToDb: backfillQualitative } = require('./backfillQualitativeRanges');
      await backfillQualitative(dbName);
      console.log('[PROVISION] Backfill rangos cualitativos aplicado');
    } catch (qErr) {
      console.warn('[PROVISION] No se pudo aplicar backfill cualitativo:', qErr.message);
    }

    // Backfill de unidades en parámetros con rangos numéricos y unit vacío
    try {
      const { execSync } = require('child_process');
      const childEnvUnits = {
        ...process.env,
        PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
        PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
        PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
        PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
        PGDATABASE: dbName,
      };
      execSync(`node ${path.resolve(__dirname, 'backfillUnits.js')}`, { stdio: 'inherit', env: childEnvUnits });
      console.log('[PROVISION] Backfill de unidades aplicado');
    } catch (uErr) {
      console.warn('[PROVISION] Backfill de unidades no aplicado:', uErr.message);
    }

    // Aplicar dedupe + índices únicos para rangos (previene duplicados futuros y limpia residuales)
    try {
      const fs2 = require('fs');
      const dedupePath = path.resolve(__dirname, '../../sql/20251011_dedupe_reference_ranges_and_unique_index.sql');
      if (fs2.existsSync(dedupePath)) {
        const sql = fs2.readFileSync(dedupePath, 'utf8');
        await tenantPool.query(sql);
        console.log('[PROVISION] Dedupe + índices únicos de rangos aplicado');
      } else {
        console.warn('[PROVISION] Archivo de dedupe de rangos no encontrado:', dedupePath);
      }
    } catch (dedupeErr) {
      console.warn('[PROVISION] No se pudo aplicar dedupe/índices de rangos:', dedupeErr.message);
    }

    // Verificación estricta: ejecutar chequeo de duplicados y abortar si hay alguno
    try {
      const checker = path.resolve(__dirname, '../tools/check-range-duplicates.js');
      const childEnv = {
        ...process.env,
        PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
        PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
        PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
        PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
        PGDATABASE: dbName,
      };
      // Si el proyecto usa DATABASE_URL, permitir override rápido
      if (process.env.TENANT_DATABASE_URL) childEnv.DATABASE_URL = process.env.TENANT_DATABASE_URL;
      require('child_process').execSync(`node ${checker}`, { stdio: 'inherit', env: childEnv });
      console.log('[PROVISION] Verificación de duplicados OK (0)');
    } catch (dupErr) {
      console.error('[PROVISION] Duplicados detectados tras aprovisionar. Abortando.');
      // Mostrar pista de cómo ejecutar chequeo manualmente
      console.error('[PROVISION] Sugerencia: export PGDATABASE=%s y ejecuta node server/tools/check-range-duplicates.js', dbName);
      process.exit(2);
    }

    // Verificación de conflictos (solapes y Ambos vs M/F) y abortar si hay alguno
    try {
      const conflictChecker = path.resolve(__dirname, '../tools/check-range-conflicts.js');
      const childEnv2 = {
        ...process.env,
        PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
        PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
        PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
        PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
        PGDATABASE: dbName,
      };
      if (process.env.TENANT_DATABASE_URL) childEnv2.DATABASE_URL = process.env.TENANT_DATABASE_URL;
      try {
        require('child_process').execSync(`node ${conflictChecker}`, { stdio: 'inherit', env: childEnv2 });
      } catch (firstFail) {
        // Si hay conflictos y --autofix=1, intentar corregirlos y volver a verificar
        if (String(autofix) === '1') {
          const fixer = path.resolve(__dirname, 'fixRangeConflicts.js');
          require('child_process').execSync(`node ${fixer} --db=${dbName}`, { stdio: 'inherit', env: childEnv2 });
          require('child_process').execSync(`node ${conflictChecker}`, { stdio: 'inherit', env: childEnv2 });
        } else {
          throw firstFail;
        }
      }
      console.log('[PROVISION] Verificación de conflictos de rangos OK (0)');
    } catch (confErr) {
      console.error('[PROVISION] Conflictos de rangos detectados (solapes/sexo). Abortando.');
      console.error('[PROVISION] Pista: export PGDATABASE=%s y ejecuta node server/tools/check-range-conflicts.js', dbName);
      process.exit(2);
    }

    // Enforcer de sexo SOLO para nuevos tenants: carga patrones desde config si existe
    try {
      if (!isNewDb) { console.log('[PROVISION] Enforcer de sexo omitido (DB existente)'); }
      if (!isNewDb) { /* no ejecutar para DB existentes */ } else {
      const { execSync } = require('child_process');
      const fs = require('fs');
      const cfgPath = path.resolve(__dirname, 'sex-enforcer.config.json');
      let femaleList = [
        'hcg', 'β-hcg', 'beta-hcg', 'prueba de embarazo',
        'papp-a', 'estriol no conjugado', 'ue3', 'inhibina a', 'afp materna',
        'tamizaje prenatal', 'triple marcador', 'cuádruple marcador'
      ];
      let maleList = [
        'psa', 'antígeno prostático', 'propsa', 'p2psa', 'phi', 'índice de salud prostática',
        'semen', 'espermiograma', 'seminograma', 'espermatobioscop', 'fructosa seminal', 'zinc seminal', 'ph seminal'
      ];
      if (fs.existsSync(cfgPath)) {
        try {
          const cfgRaw = fs.readFileSync(cfgPath, 'utf8');
          const cfg = JSON.parse(cfgRaw);
          if (Array.isArray(cfg.female) && cfg.female.length) femaleList = cfg.female;
          if (Array.isArray(cfg.male) && cfg.male.length) maleList = cfg.male;
          console.log('[PROVISION] sex-enforcer.config.json cargado');
        } catch (e) {
          console.warn('[PROVISION] No se pudo parsear sex-enforcer.config.json, usando defaults:', e.message);
        }
      }
      const enforcer = (like, target) => `node ${path.resolve(__dirname, 'enforceSexExclusive.js')} --db=${dbName} --target=${target} --like="${like}" --write`;
      const femaleLike = femaleList.join('|');
      const maleLike = maleList.join('|');
      const extractJson = (txt) => {
        if (!txt) return null;
        try { return JSON.parse(txt); } catch(parseErr1) { /* ignore non-JSON */ }
        const first = txt.indexOf('{');
        const last = txt.lastIndexOf('}');
        if (first >= 0 && last > first) {
          const slice = txt.slice(first, last + 1);
          try { return JSON.parse(slice); } catch(parseErr2) { /* ignore non-JSON slice */ }
        }
        return null;
      };
      let outFemale = '', outMale = '';
      try { outFemale = execSync(enforcer(femaleLike, 'Femenino'), { encoding: 'utf8' }); } catch (e) { outFemale = String(e.stdout || e.message || ''); }
      try { outMale = execSync(enforcer(maleLike, 'Masculino'), { encoding: 'utf8' }); } catch (e) { outMale = String(e.stdout || e.message || ''); }
      const repF = extractJson(outFemale) || { ok:false };
      const repM = extractJson(outMale) || { ok:false };
      console.log('[PROVISION] Enforcer de sexo aplicado (Femenino M/U/D=%s/%s/%s, Masculino M/U/D=%s/%s/%s)'.replace('%s',''+(repF.matched||0)).replace('%s',''+(repF.updated||0)).replace('%s',''+(repF.deleted||0)).replace('%s',''+(repM.matched||0)).replace('%s',''+(repM.updated||0)).replace('%s',''+(repM.deleted||0)));
      try {
        const details = {
          female: { matched: repF.matched||0, updated: repF.updated||0, deleted: repF.deleted||0 },
          male: { matched: repM.matched||0, updated: repM.updated||0, deleted: repM.deleted||0 },
          patterns: { female: femaleList, male: maleList }
        };
        await tenantPool.query('INSERT INTO system_audit_logs(action, details, entity) VALUES ($1,$2,$3)', [
          'sex_enforcer_applied', details, 'reference_ranges'
        ]);
      } catch (logErr) {
        console.warn('[PROVISION] No se pudo registrar auditoría enforcer:', logErr.message);
      }
      }
    } catch (sexEnfErr) {
      console.warn('[PROVISION] Enforcer de sexo no se pudo aplicar:', sexEnfErr.message);
    }

    // Compleción y normalización de rangos de Hematología (solo DB nuevas)
    try {
      if (!isNewDb) {
        console.log('[PROVISION] Hematología omitida (DB existente)');
      } else {
        const { execSync } = require('child_process');
        const childEnvHema = {
          ...process.env,
          PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
          PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
          PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
          PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
          PGDATABASE: dbName,
        };
        // Completar bandas M/F a partir de 'Ambos' en parámetros de hematología clave
        execSync(`node ${path.resolve(__dirname, 'enforceHematologyCompleteness.js')} --write`, { stdio: 'inherit', env: childEnvHema });
        // Normalizar límites de edad (1..12 vs 1..13, etc.) y limpiar duplicados exactos si se crean
        execSync(`node ${path.resolve(__dirname, 'snapHematologyAgeBoundaries.js')} --write`, { stdio: 'inherit', env: childEnvHema });
        // Re-verificar conflictos tras normalización
        const conflictChecker = path.resolve(__dirname, '../tools/check-range-conflicts.js');
        try {
          execSync(`node ${conflictChecker}`, { stdio: 'inherit', env: childEnvHema });
          console.log('[PROVISION] Conflictos de Hematología: OK (0)');
        } catch (hemaConf) {
          if (String(autofix) === '1') {
            const fixer = path.resolve(__dirname, 'fixRangeConflicts.js');
            execSync(`node ${fixer} --db=${dbName}`, { stdio: 'inherit', env: childEnvHema });
            execSync(`node ${conflictChecker}`, { stdio: 'inherit', env: childEnvHema });
            console.log('[PROVISION] Conflictos de Hematología corregidos');
          } else {
            throw hemaConf;
          }
        }
      }
    } catch (hemaErr) {
      console.warn('[PROVISION] Hematología no se pudo completar/normalizar:', hemaErr.message);
    }

    // Verificación: parámetros numéricos sin unidad (debe ser 0)
    try {
      const childEnvUnits = {
        ...process.env,
        PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
        PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
        PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
        PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
        PGDATABASE: dbName,
      };
      const out = require('child_process').execFileSync('node', [path.resolve(__dirname, '../tools/check-missing-units.js')], { env: childEnvUnits });
      let report = {};
      try { report = JSON.parse(String(out)); } catch(e) { report = { ok:false, parseError: String(e.message||e) }; }
      const total = Number(report.total || 0);
      if (String(verify) === '1' && total > 0) {
        console.error('[PROVISION] Parámetros numéricos sin unidad: %d. Abortando.', total);
        console.error('[PROVISION] Ejecuta: PGDATABASE=%s node server/tools/check-missing-units.js', dbName);
        process.exit(2);
      } else {
        console.log('[PROVISION] Verificación de unidades: faltantes=%d', total);
      }
    } catch (vuErr) {
      console.warn('[PROVISION] Verificación de unidades no disponible:', vuErr.message);
    }

    // Verificación rápida de metadatos en analysis (diaria, no bloqueante)
    try {
  const { rows: check } = await tenantPool.query(`SELECT name, code, category, description, indications, sample_type, sample_container, processing_time_hours FROM analysis ORDER BY created_at DESC LIMIT 20`);
  const missing = check.filter(r => !r.description || !r.sample_type || !r.sample_container || r.processing_time_hours === null || r.processing_time_hours === undefined);
      console.log('[PROVISION][VERIFY] Estudios con metadatos faltantes:', missing.length);
      // Checar que la columna category esté presente y poblada al menos en algunos
      const { rows: catAgg } = await tenantPool.query(`SELECT COUNT(*)::int AS total, COUNT(category)::int AS with_category FROM analysis`);
      console.log('[PROVISION][VERIFY] Categoría en analysis: %d/%d con valor', catAgg[0]?.with_category || 0, catAgg[0]?.total || 0);
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
        // Verificación global de metadatos en analysis (no sólo últimas filas)
        const { rows: mc } = await tenantPool.query(`
          SELECT COUNT(*)::int AS c
          FROM analysis
          WHERE COALESCE(NULLIF(TRIM(description), ''), '') = ''
             OR COALESCE(NULLIF(TRIM(sample_type), ''), '') = ''
             OR COALESCE(NULLIF(TRIM(sample_container), ''), '') = ''
             OR processing_time_hours IS NULL
        `);
        const missingCount = mc[0]?.c ?? 0;
        verificationReport = { missingCols, rolesReport, analysisMetadataMissing: missingCount };
        if (missingCols.length) {
          console.warn('[PROVISION][VERIFY] Columnas faltantes:', missingCols.join(','));
        }
        console.log('[PROVISION][VERIFY] Metadatos analysis faltantes (global):', missingCount);
        console.log('[PROVISION][VERIFY] Reporte:', JSON.stringify(verificationReport));
        if (missingCount > 0) {
          console.error('[PROVISION][VERIFY] Aún hay estudios sin metadatos tras aplicar defaults. Abortando.');
          process.exit(3);
        }
      } catch(e){ console.warn('[PROVISION][VERIFY] Error verificación:', e.message); }
    }

      // Enforcer final M/F en adultos (post-todo): asegura que nada previo deje 'Ambos' en adultos sin pares
      try {
        if (isNewDb) {
          const childEnv = {
            ...process.env,
            PGHOST: process.env.TENANT_PGHOST || process.env.PGHOST,
            PGPORT: process.env.TENANT_PGPORT || process.env.PGPORT,
            PGUSER: process.env.TENANT_PGUSER || process.env.PGUSER,
            PGPASSWORD: (process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
            PGDATABASE: dbName,
          };
          const enforceScript = path.resolve(__dirname, 'enforceAdultSexPairs.js');
          // Patrón amplio pero acotado a hormonales y ginecológicos por nombre de análisis/parámetro
          const like = 'hormona|hormonal|ginecol|fsh|lh|prolactina|estradiol|progesterona|testosterona|dhea|androstenediona|amh|shbg|igf|gh|dht|cortisol|acth|estrona|estriol|e1|e2|e3';
          const out = require('child_process').execFileSync('node', [enforceScript, `--like=${like}`, '--write'], { env: childEnv, encoding: 'utf8' });
          try { const rep = JSON.parse(out); console.log('[PROVISION] Enforcer final M/F adultos:', JSON.stringify({ matched: rep.matchedParameters, inserted: rep.inserted })); }
          catch(_) { console.log('[PROVISION] Enforcer final M/F adultos output:', (out||'').slice(0,400)); }
          // Auditoría de confirmación (no bloqueante)
          try {
            const auditScript = path.resolve(__dirname, 'auditSexSplitHormones.js');
            const auditOut = require('child_process').execFileSync('node', [auditScript, '--like="%Hormonal%|%Ginecol%"'], { env: childEnv, encoding: 'utf8' });
            console.log('[PROVISION] Auditoría post-enforcer:', auditOut.trim());
          } catch (audErr) {
            console.warn('[PROVISION] Auditoría post-enforcer falló:', (audErr && audErr.message || '').split('\n')[0]);
          }
        } else {
          console.log('[PROVISION] Enforcer final omitido (DB existente)');
        }
      } catch (finalEnfErr) {
        console.warn('[PROVISION] Enforcer final M/F adultos no se pudo aplicar:', finalEnfErr.message);
      }

    await tenantPool.end();
  } catch (e) {
    console.error('[PROVISION] Error aplicando migraciones iniciales:', e.message);
    process.exit(1);
  }
  // 3. Registrar en master (tenants + tenant_admins) asegurando status=active y db_version correcto
  const pwHash = await bcrypt.hash(password, 10);
  try {
    await masterPool.query('BEGIN');
    // Intentar deducir versión aplicada de migraciones por-tenant ejecutadas arriba
    const fs = require('fs');
    const path = require('path');
    let targetVersion = 0;
  try {
      const tenantMigDir = path.resolve(__dirname, '../../sql/tenant_migrations');
      if (fs.existsSync(tenantMigDir)) {
        const migFiles = fs.readdirSync(tenantMigDir)
          .filter(f => /^\d{3}_.+\.sql$/.test(f))
          .sort();
        if (migFiles.length) targetVersion = parseInt(migFiles[migFiles.length-1].slice(0,3), 10) || 0;
      }
  } catch(err){ console.warn('[PROVISION] No se pudo leer versión de migraciones tenant:', err.message); }

    const tRes = await masterPool.query(
      `INSERT INTO tenants(slug, db_name, plan, status, db_version)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET plan=EXCLUDED.plan, status='active', db_version=GREATEST(tenants.db_version, EXCLUDED.db_version)
       RETURNING id`,
      [slug, dbName, plan, 'active', targetVersion]
    );
    const tenantId = tRes.rows[0].id;
    await masterPool.query(
      'INSERT INTO tenant_admins(tenant_id, email, password_hash, role) VALUES($1,$2,$3,$4) ON CONFLICT (tenant_id, email) DO NOTHING',
      [tenantId, email, pwHash, 'owner']
    );
    await masterPool.query(
      'INSERT INTO tenant_events(tenant_id, event_type, meta) VALUES($1,$2,$3)',
      [tenantId, 'provisioned', JSON.stringify({ slug, dbName, plan })]
    );
    await masterPool.query('COMMIT');
    console.log('[PROVISION] Listo. tenant_id=%s (status=active, db_version=%d)', tenantId, targetVersion);
  } catch (e) {
    await masterPool.query('ROLLBACK');
    console.error('[PROVISION] Error registrando tenant en master:', e.message);
    process.exit(1);
  } finally {
    await masterPool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
