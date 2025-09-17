const client = require('prom-client');
const { pool } = require('./db');
client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de solicitudes HTTP',
  labelNames: ['method','route','status'],
  buckets: [0.01,0.05,0.1,0.3,0.5,1,2,5]
});

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const diff = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, String(res.statusCode)).observe(diff);
  });
  next();
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
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}

// DB Pool Gauges
const dbPoolTotal = new client.Gauge({ name: 'db_pool_total_connections', help: 'Total conexiones en el pool PG' });
const dbPoolIdle = new client.Gauge({ name: 'db_pool_idle_connections', help: 'Conexiones idle en el pool PG' });
const dbPoolWaiting = new client.Gauge({ name: 'db_pool_waiting_clients', help: 'Clientes esperando conexión PG' });

module.exports = { metricsMiddleware, metricsEndpoint };
