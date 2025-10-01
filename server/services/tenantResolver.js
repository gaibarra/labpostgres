/**
 * tenantResolver.js
 * Multi-tenant helper (one PostgreSQL database per laboratory / tenant).
 * - Master DB (configured via MASTER_PG* env vars) stores tenants + admins.
 * - Each request carries a tenantId (from JWT after login against master).
 * - We lazy-create and cache a pg.Pool per tenant database.
 */
import { Pool } from 'pg';

// Master DB config (DO NOT point these to a tenant DB)
const masterPool = new Pool({
  host: process.env.MASTER_PGHOST || process.env.PGHOST,
  port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
  user: process.env.MASTER_PGUSER || process.env.PGUSER,
  password: process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD,
  database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master',
  max: 5,
  idleTimeoutMillis: 30000
});

// Cache: tenantId -> { pool, dbName, status, dbVersion }
const tenantCache = new Map();
const CACHE_TTL_MS = 60_000; // 1 min basic TTL (can be tuned)

async function fetchTenantRecord(tenantId) {
  const { rows } = await masterPool.query(
    'SELECT id, slug, db_name, status, db_version FROM tenants WHERE id = $1',
    [tenantId]
  );
  if (!rows.length) throw new Error('TENANT_NOT_FOUND');
  const t = rows[0];
  if (t.status !== 'active') throw new Error('TENANT_INACTIVE');
  return t;
}

function buildTenantPool(dbName) {
  return new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST || '127.0.0.1',
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
    max: Number(process.env.TENANT_POOL_MAX || 10),
    idleTimeoutMillis: 30000
  });
}

export async function getTenantPool(tenantId) {
  const cached = tenantCache.get(tenantId);
  const now = Date.now();
  if (cached && (now - cached.cachedAt) < CACHE_TTL_MS) {
    return cached.pool;
  }
  const rec = await fetchTenantRecord(tenantId);
  const pool = cached?.pool || buildTenantPool(rec.db_name);
  tenantCache.set(tenantId, { pool, dbName: rec.db_name, status: rec.status, dbVersion: rec.db_version, cachedAt: now });
  return pool;
}

// Helper to run a function with a client
export async function withTenant(tenantId, fn) {
  const pool = await getTenantPool(tenantId);
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// Simple provisioning action (DB creation is left to external script / superuser)
export async function registerTenant({ slug, dbName, adminEmail, passwordHash, plan = 'standard' }) {
  return await masterPool.query('BEGIN').then(async () => {
    try {
      const tRes = await masterPool.query(
        'INSERT INTO tenants(slug, db_name, plan) VALUES($1,$2,$3) RETURNING id',
        [slug, dbName, plan]
      );
      const tenantId = tRes.rows[0].id;
      await masterPool.query(
        'INSERT INTO tenant_admins(tenant_id, email, password_hash, role) VALUES ($1,$2,$3,$4)',
        [tenantId, adminEmail, passwordHash, 'owner']
      );
      await masterPool.query(
        'INSERT INTO tenant_events(tenant_id, event_type, meta) VALUES ($1,$2,$3)',
        [tenantId, 'provisioned', JSON.stringify({ slug, dbName })]
      );
      await masterPool.query('COMMIT');
      return { tenantId };
    } catch (e) {
      await masterPool.query('ROLLBACK');
      throw e;
    }
  });
}

// Middleware example (expects req.auth.tenant_id from auth layer)
export function tenantMiddleware() {
  return async (req, res, next) => {
    const tenantId = req.auth?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'NO_TENANT' });
    try {
      req.tenantPool = await getTenantPool(tenantId);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Graceful shutdown helper
export async function closeAllTenantPools() {
  const closes = [];
  for (const { pool } of tenantCache.values()) closes.push(pool.end());
  await Promise.allSettled(closes);
  await masterPool.end();
}

// Health check (master + one optional tenant)
export async function masterHealth(tenantId) {
  const { rows } = await masterPool.query('SELECT 1 as ok');
  const r = { master: rows[0].ok === 1 };
  if (tenantId) {
    try {
      const pool = await getTenantPool(tenantId);
      const t = await pool.query('SELECT 1 as ok');
      r.tenant = t.rows[0].ok === 1;
    } catch (e) {
      r.tenant = false;
    }
  }
  return r;
}
