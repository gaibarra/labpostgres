#!/usr/bin/env node
// Simple migration runner: executes *.sql in ../sql in sorted order.
// Skips files with 'rollback' in name for forward run.
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const crypto = require('crypto');

(async () => {
  const dir = path.resolve(__dirname, '../../sql');
  // Ensure required schemas exist (auth used by some scripts)
  try { await pool.query('CREATE SCHEMA IF NOT EXISTS auth'); } catch (e) { console.warn('No se pudo crear schema auth:', e.message); }
  // Stub minimal Supabase functions if missing (auth.uid)
  try {
    await pool.query("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;");
  } catch (e) { console.warn('No se pudo crear stub auth.uid:', e.message); }
  // Ensure tracking table
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id serial PRIMARY KEY,
    filename text UNIQUE NOT NULL,
    checksum text,
    executed_at timestamptz DEFAULT now()
  );`);

  // Load already executed filenames
  const executedRes = await pool.query('SELECT filename FROM schema_migrations');
  const executed = new Set(executedRes.rows.map(r=>r.filename));

  const all = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql') && !f.includes('rollback'));
  // Orden lógico revisado:
  // 0: consolidated (estado base parcial inicial sin columna position)
  // 1: script específico que añade position (antes de setup que la requiere)
  // 2: setup maestro (idempotente, asume que position ya existe si la tabla fue creada antes)
  // 3: create_*
  // 4: add_*
  // 5: resto (normalize_/update_/post_...)
  const priority = (name) => {
    if (/consolidated/i.test(name)) return 0;
    if (/add_position_to_analysis_parameters/i.test(name)) return 1; // asegurar antes de setup
    if (/setup\.sql$/i.test(name)) return 2;
    if (/create_/i.test(name)) return 3;
    if (/add_/i.test(name)) return 4;
    return 5;
  };
  const files = all.sort((a,b)=>{
    const pa=priority(a), pb=priority(b);
    if (pa!==pb) return pa-pb;
    return a.localeCompare(b);
  });
  console.log('Ejecutando migraciones:', files);
  const markExecuted = async (file, checksum) => {
    try {
      await pool.query(
        `INSERT INTO schema_migrations(filename, checksum)
         SELECT $1, $2
         WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE filename = $1)`,
        [file, checksum]
      );
      executed.add(file);
    } catch (e) {
      console.warn('No se pudo registrar schema_migrations para', file, e.message);
    }
  };

  for (const file of files) {
    // If already executed, skip early
    if (executed.has(file)) {
      console.log(`--> ${file}... SKIP (registrado en schema_migrations)`);
      continue;
    }
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full,'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    // Skip setup.sql if consolidated already ran (tables exist) AND position ya asegurada
    if (/setup\.sql$/i.test(file)) {
      try {
        const { rows } = await pool.query(`SELECT
          to_regclass('public.analysis') AS analysis_exists,
          to_regclass('public.patients') AS patients_exists,
          (
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name='analysis_parameters' AND column_name='position'
            )
          ) AS has_position`);
        if (rows[0].analysis_exists && rows[0].patients_exists && rows[0].has_position) {
          console.log(`--> ${file}... SKIP (estado base + position ya creados)`);
          await markExecuted(file, checksum);
          continue;
        }
        // Si las tablas base existen pero falta la columna position (caso legacy), crearla antes de ejecutar setup
        if (rows[0].analysis_exists && !rows[0].has_position) {
          console.log('Preflight: añadiendo columna position antes de setup.sql');
          try {
            await pool.query(`ALTER TABLE analysis_parameters ADD COLUMN IF NOT EXISTS position int;\nWITH ordered AS (\n  SELECT id, ROW_NUMBER() OVER (PARTITION BY analysis_id ORDER BY created_at, name) rn\n  FROM analysis_parameters WHERE position IS NULL\n)\nUPDATE analysis_parameters ap SET position=o.rn FROM ordered o WHERE ap.id=o.id;\nCREATE INDEX IF NOT EXISTS idx_analysis_parameters_analysis_id_position ON analysis_parameters(analysis_id, position);`);
            console.log('Preflight position OK');
          } catch (e) {
            console.warn('No se pudo aplicar preflight position:', e.message);
          }
        }
      } catch (_) { /* ignore and attempt to run file */ }
    }

    // Skip legacy create_* scripts if base tables already exist (analysis, analysis_parameters, reference_ranges)
    if (/create_(analysis|analysis_parameters|reference_ranges)_table\.sql$/i.test(file)) {
      try {
        const { rows } = await pool.query("SELECT to_regclass('public.analysis') AS a, to_regclass('public.analysis_parameters') AS ap, to_regclass('public.reference_ranges') AS rr");
        if (rows[0].a && rows[0].ap && rows[0].rr) {
          console.log(`--> ${file}... SKIP (legacy create_* redundante)`);
          await markExecuted(file, checksum);
          continue;
        }
      } catch (e) { /* fall through */ }
    }
    process.stdout.write(`--> ${file}... `);
    try {
      await pool.query(sql);
      console.log('OK');
      await markExecuted(file, checksum);
    } catch (e) {
      console.error(`FALLO en ${file}:`, e.message);
      process.exit(1);
    }
  }
  await pool.end();
  console.log('Migraciones completadas');
})().catch(e => { console.error(e); process.exit(1); });
