#!/usr/bin/env node
// Bootstrap + migraciones: crea DB (si usa DATABASE_URL con pgtools se omite), luego corre migraciones.
// Nota: requiere que el usuario PG tenga privilegios de creación si la DB no existe.
const { execSync } = require('child_process');
const { pool } = require('../db');
const { Client } = require('pg');

async function ensureDatabase() {
  if (process.env.DATABASE_URL) {
    console.log('[bootstrap] Usando DATABASE_URL, se asume DB existente.');
    return;
  }
  const { PGDATABASE, PGUSER, PGHOST, PGPORT, PGPASSWORD } = process.env;
  if (!PGDATABASE) { console.log('[bootstrap] PGDATABASE no definido, omitiendo creación.'); return; }
  // Conectamos a DB "postgres" para crear la target si no existe.
  const adminClient = new Client({
    host: PGHOST || 'localhost',
    port: PGPORT ? Number(PGPORT) : 5432,
    user: PGUSER || 'postgres',
    password: PGPASSWORD || 'postgres',
    database: 'postgres'
  });
  try {
    await adminClient.connect();
    const res = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1',[PGDATABASE]);
    if (!res.rowCount) {
      console.log(`[bootstrap] Creando base de datos ${PGDATABASE}...`);
      await adminClient.query(`CREATE DATABASE ${PGDATABASE}`);
      console.log('[bootstrap] DB creada.');
    } else {
      console.log('[bootstrap] DB ya existe.');
    }
  } catch (e) {
    console.error('[bootstrap] No se pudo verificar/crear la DB:', e.message);
  } finally {
    await adminClient.end();
  }
}

async function runMigrations() {
  try {
    await require('./run-migrations');
  } catch (e) {
    console.error('[bootstrap] Error en migraciones:', e.message);
    process.exit(1);
  }
}

(async ()=>{
  await ensureDatabase();
  // Reabrir pool a la DB objetivo si no era la misma
  try { await pool.query('SELECT 1'); } catch (e) { console.error('[bootstrap] Conexión a DB objetivo falló:', e.message); }
  await runMigrations();
})();
