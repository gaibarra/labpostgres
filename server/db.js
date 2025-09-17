// Robust .env loading: try local, then parent (repo root) so running from root o subcarpeta funciona.
const fs = require('fs');
const path = require('path');
(() => {
  const localEnv = path.resolve(process.cwd(), '.env');
  let loadedPath = null;
  if (fs.existsSync(localEnv)) {
    require('dotenv').config({ path: localEnv });
    loadedPath = localEnv;
  } else {
    const parentEnv = path.resolve(process.cwd(), '..', '.env');
    if (fs.existsSync(parentEnv)) {
      require('dotenv').config({ path: parentEnv });
      loadedPath = parentEnv;
    } else {
      require('dotenv').config(); // fallback default search
    }
  }
  if (process.env.DEBUG_ENV_LOAD) {
    console.log('[ENV] archivo cargado:', loadedPath || '(por defecto - ninguno encontrado explícitamente)');
  }
})();
const { Pool } = require('pg');

// Use DATABASE_URL if provided, else individual vars
const connectionString = process.env.DATABASE_URL;
// Si PG* faltan porque sólo existen en server/.env, intentar cargar ese archivo manualmente (ya se probó arriba current + parent)
if (!connectionString && !process.env.PGDATABASE && !process.env.PGHOST) {
  const serverEnv = path.resolve(__dirname, '.env');
  if (fs.existsSync(serverEnv)) {
    require('dotenv').config({ path: serverEnv, override: false });
    if (process.env.DEBUG_ENV_LOAD) console.log('[ENV] cargado adicional server/.env');
  }
}

const baseConfig = connectionString ? { connectionString } : {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};

const pool = new Pool(baseConfig);

// Initial connectivity diagnostics with limited retries (non-blocking)
async function initialDbProbe(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      if (attempt > 1) {
        console.log(`[DB] Conectado tras reintento #${attempt}`);
      } else {
        console.log('[DB] Conexión a PostgreSQL OK');
      }
      return true;
    } catch (err) {
      const redacted = { ...baseConfig, password: baseConfig.password ? '***' : undefined, connectionString: connectionString ? '***' : undefined };
      console.error(`[DB] Fallo conexión intento ${attempt}/${retries}:`, err.code || err.message, 'config:', redacted);
      if (attempt === retries) {
        console.error('[DB] No se pudo establecer conexión inicial. Verifica credenciales (.env: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE o DATABASE_URL). El servidor seguirá intentando en cada query, pero la UI fallará hasta corregirlo.');
      } else {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  return false;
}

initialDbProbe().then(ok => {
  if (!ok) {
    console.error('[DB] Advertencia: credenciales incorrectas impiden las operaciones.');
  }
});

pool.on('error', (err) => {
  if (process.env.TEST_MODE) return; // silence during tests
  console.error('PostgreSQL pool error', err);
});

async function healthCheck() {
  const { rows } = await pool.query('SELECT 1 as ok');
  return rows[0].ok === 1;
}

module.exports = { pool, healthCheck };
