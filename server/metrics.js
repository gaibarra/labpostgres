const client = require('prom-client');
const { pool } = require('./db');
client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de solicitudes HTTP',
  // tenant opcional (si no hay tenant_id se usa 'none')
  labelNames: ['method','route','status','tenant'],
  buckets: [0.01,0.05,0.1,0.3,0.5,1,2,5]
});

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const diff = Number(process.hrtime.bigint() - start) / 1e9;
    const tenantLabel = req.auth?.tenant_id || 'none';
    httpRequestDuration.labels(req.method, req.route?.path || req.path, String(res.statusCode), tenantLabel).observe(diff);
  });
  next();
}

// Per-tenant pool gauges (only counts active cached pools if multi-tenant enabled)
const tenantPoolActive = new client.Gauge({ name: 'tenant_pools_active_total', help: 'Cantidad de pools de tenants activos (cache)' });
const tenantPoolDbConnections = new client.Gauge({ name: 'tenant_pools_connections_total', help: 'Suma de conexiones (totalCount) en pools de tenants' });

let lastTenantPoolRefresh = 0;
async function refreshTenantPoolMetrics(){
  if (Date.now() - lastTenantPoolRefresh < 5000) return; // throttle 5s
  lastTenantPoolRefresh = Date.now();
  try {
    if (process.env.MULTI_TENANT === '1') {
      // Cargar on-demand tenantResolver sin romper si no existe
      const resolver = require('./services/tenantResolver');
      const cache = resolver.__getCache ? resolver.__getCache() : null;
      if (cache && typeof cache === 'object') {
        let pools = 0, totalConnections = 0;
        for (const v of cache.values()) {
          if (v?.pool) {
            pools += 1;
            totalConnections += (v.pool.totalCount || 0);
          }
        }
        tenantPoolActive.set(pools);
        tenantPoolDbConnections.set(totalConnections);
      }
    }
  } catch(_) { /* ignore */ }
}

async function metricsEndpoint(_req, res) {
  // Update dynamic pool gauges just-in-time
  if (pool) {
    try {
      dbPoolTotal.set(pool.totalCount || 0);
      dbPoolIdle.set(pool.idleCount || 0);
      dbPoolWaiting.set(pool.waitingCount || 0);
    } catch (_) { /* ignore */ }
  }
  await refreshTenantPoolMetrics();
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}

// DB Pool Gauges
const dbPoolTotal = new client.Gauge({ name: 'db_pool_total_connections', help: 'Total conexiones en el pool PG' });
const dbPoolIdle = new client.Gauge({ name: 'db_pool_idle_connections', help: 'Conexiones idle en el pool PG' });
const dbPoolWaiting = new client.Gauge({ name: 'db_pool_waiting_clients', help: 'Clientes esperando conexión PG' });

// Revocaciones y validaciones de tokens
const tokenRevocations = new client.Counter({ name: 'auth_token_revocations_total', help: 'Total de revocaciones explícitas (logout, admin, blacklist)' , labelNames: ['reason']});
const tokenVersionMismatch = new client.Counter({ name: 'auth_token_version_mismatch_total', help: 'Tokens rechazados por versionado (token_version desincronizado)' });
const tokenJtiBlacklistHits = new client.Counter({ name: 'auth_token_jti_blacklist_hits_total', help: 'Tokens rechazados por jti en blacklist' });
const tenantPoolEvictions = new client.Counter({ name: 'tenant_pool_evictions_total', help: 'Cantidad de pools de tenants cerrados por límite/rotación', labelNames: ['reason'] });

function incRevocation(reason='unknown'){ tokenRevocations.inc({ reason }); }
function incVersionMismatch(){ tokenVersionMismatch.inc(); }
function incJtiBlacklistHit(){ tokenJtiBlacklistHits.inc(); }
function incTenantPoolEviction(reason='unknown'){ tenantPoolEvictions.inc({ reason }); }

module.exports = { metricsMiddleware, metricsEndpoint, incRevocation, incVersionMismatch, incJtiBlacklistHit, incTenantPoolEviction };
