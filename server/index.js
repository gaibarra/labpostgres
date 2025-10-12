require('dotenv').config();
// Log inicial de variables clave para depuración multi-tenant
try {
  console.log('[BOOT] MULTI_TENANT=', process.env.MULTI_TENANT, 'TENANT_DEBUG=', process.env.TENANT_DEBUG, 'NODE_ENV=', process.env.NODE_ENV);
} catch (e) { /* noop log */ }
const express = require('express');
const security = require('./middleware/security');
const requestId = require('./middleware/requestId');
const { httpLogger } = require('./logger');
const cors = require('cors');
const { AppError, errorResponse } = require('./utils/errors');
const { metricsMiddleware, metricsEndpoint } = require('./metrics');
const cookieParser = require('cookie-parser');
const net = require('net');
const { execSync } = require('child_process');
const authMiddleware = require('./middleware/auth');

const app = express();

// --- Lightweight ping (sin DB) para diagnóstico rápido de bloqueo ---
app.get('/api/ping', (_req,res)=>{ res.type('application/json').send(JSON.stringify({ pong:true, t:Date.now(), uptimeSeconds: process.uptime() })); });

// Medir lag de event loop (simple)
let lastLagSample = { maxMs: 0, lastMs: 0 };
let lagTimerStart = Date.now();
setInterval(()=>{
  const start = Date.now();
  setImmediate(()=>{
    const d = Date.now() - start;
    lastLagSample.lastMs = d;
    if (d > lastLagSample.maxMs) lastLagSample.maxMs = d;
  });
  // Reinicio window cada 10 min para que max no crezca indef.
  if (Date.now() - lagTimerStart > 600000) { lagTimerStart = Date.now(); lastLagSample.maxMs = 0; }
}, 1000).unref();

// Middleware
// CORS origins (comma separated). Supports wildcards '*'.
// Example: CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://192.168.*:5173,https://app.midominio.com"
const rawOrigins = process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174';
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const allowedOriginMatchers = rawOrigins.split(',')
  .map(s=>s.trim())
  .filter(Boolean)
  .map(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.split('*').map(escapeRegex).join('.*') + '$');
      return { pattern, test: (origin) => regex.test(origin) };
    }
    return { pattern, test: (origin) => origin === pattern };
  });
function isAllowedOrigin(origin){
  if (allowedOriginMatchers.some(m => m.test(origin))) return true;
  // Auto-allow localhost in development if not explicitly listed
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/localhost:\d+$/i.test(origin)) return true;
    if (/^https?:\/\/127\.0\.0\.1:\d+$/i.test(origin)) return true;
  }
  return false;
}
const corsDebug = !!process.env.CORS_LOG;
if (corsDebug) console.log('[CORS] Allowed origin patterns:', allowedOriginMatchers.map(m=>m.pattern));
app.use(cors({
  origin(origin, callback){
    if (!origin) { // non-browser or same-origin
      if (corsDebug) console.log('[CORS] allow (no origin header)');
      return callback(null, true);
    }
    if (isAllowedOrigin(origin)) {
      if (corsDebug) console.log('[CORS] allow', origin);
      return callback(null, true);
    }
  if (corsDebug) console.warn('[CORS] reject', origin, 'allowedPatterns=', allowedOriginMatchers.map(m=>m.pattern));
  // Responder 403 clara en vez de cortar sin encabezados para debug más fácil
  const err = new Error('CORS: origin not allowed');
  err.statusCode = 403;
  return callback(err);
  },
  credentials: true
}));
// Extra debug: log every request origin if CORS_LOG enabled
if (corsDebug) app.use((req,res,next)=>{ console.log('[REQ]', req.method, req.originalUrl, 'Origin:', req.headers.origin); next(); });
// Explicit preflight route using regex (avoids path-to-regexp '*' issue under Express 5)
app.options(/.*/, cors());
app.use(requestId());
app.use(httpLogger);
app.use(security);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(metricsMiddleware);
app.use(cookieParser());

// Basic route
app.get('/', (req, res) => {
  res.send('API del Laboratorio funcionando!');
});

// Rutas Auth
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Multi-tenant (habilitar con MULTI_TENANT=1). Carga perezosa ANTES de registrar rutas.
let tenantMw = null;
let masterHealthFn = null;
if (process.env.MULTI_TENANT === '1') {
  try {
    const { tenantMiddleware, masterHealth } = require('./services/tenantResolver');
    tenantMw = tenantMiddleware();
    masterHealthFn = masterHealth;
    console.log('[MT] Multi-tenancy habilitado');
  } catch (e) {
    console.error('[MT] No se pudo cargar tenantResolver:', e.message);
  }
}

// Helper para registrar rutas con soporte multi-tenant opcional
function registerRoute(path, router, opts = {}) {
  const { tenant = true } = opts;
  if (tenant && tenantMw) {
  // Orden: auth primero (decodifica JWT y llena req.auth), luego tenantMw
  app.use(path, authMiddleware, tenantMw, router);
  } else {
    app.use(path, router);
  }
}

// Rutas Pacientes
const patientRoutes = require('./routes/patients');
registerRoute('/api/patients', patientRoutes, { tenant: true });

// Rutas Work Orders
const workOrderRoutes = require('./routes/workOrders');
registerRoute('/api/work-orders', workOrderRoutes, { tenant: true });

// Rutas Usuarios (admin) (en muchos casos son globales al tenant)
const userRoutes = require('./routes/users');
registerRoute('/api/users', userRoutes, { tenant: true });

// Rutas Auditoría
const auditRoutes = require('./routes/audit');
registerRoute('/api/audit', auditRoutes, { tenant: true });

// Rutas Admin Tokens (gestión tokens activos / revocación)
const adminTokensRoutes = require('./routes/adminTokens');
app.use('/api/auth/admin', adminTokensRoutes);

// Rutas Marketing AI (placeholder)
const marketingRoutes = require('./routes/marketing');
registerRoute('/api/marketing', marketingRoutes, { tenant: true });

// Roles (solo listado por ahora) - si multi-tenant, aplicar middleware para inyectar pool
const rolesRoutes = require('./routes/roles');
if (tenantMw) app.use('/api/roles', authMiddleware, tenantMw, rolesRoutes); else app.use('/api/roles', rolesRoutes);

// Rutas Profiles (restaurada)
const profilesRoutes = require('./routes/profiles');
registerRoute('/api/profiles', profilesRoutes, { tenant: true });

// Rutas dominio laboratorio adicionales
const analysisRoutes = require('./routes/analysis');
registerRoute('/api/analysis', analysisRoutes, { tenant: true });
const referrersRoutes = require('./routes/referrers');
registerRoute('/api/referrers', referrersRoutes, { tenant: true });
const packagesRoutes = require('./routes/packages');
registerRoute('/api/packages', packagesRoutes, { tenant: true });
// AI assist
const aiRoutes = require('./routes/ai');
registerRoute('/api/ai', aiRoutes, { tenant: true });
// Catálogo clínico
const catalogRoutes = require('./routes/catalog');
registerRoute('/api', catalogRoutes, { tenant: true });
// Configuración laboratorio
const configRoutes = require('./routes/config');
const configValidateRoutes = require('./routes/configValidate');
const financeRoutes = require('./routes/finance');
registerRoute('/api/config', configRoutes, { tenant: true });
registerRoute('/api/config', configValidateRoutes, { tenant: true }); // sub-ruta validate
registerRoute('/api/finance', financeRoutes, { tenant: true });
// Parámetros del sistema
const parametersRoutes = require('./routes/parameters');
registerRoute('/api/parameters', parametersRoutes, { tenant: true });
// Plantillas
const templatesRoutes = require('./routes/templates');
registerRoute('/api/templates', templatesRoutes, { tenant: true });
// Sucursales
const branchesRoutes = require('./routes/branches');
registerRoute('/api/branches', branchesRoutes, { tenant: true });

// Antibiotics catalog and antibiogram results
const antibioticsRoutes = require('./routes/antibiotics');
registerRoute('/api/antibiotics', antibioticsRoutes, { tenant: true });
const antibiogramRoutes = require('./routes/antibiogram');
registerRoute('/api/antibiogram', antibiogramRoutes, { tenant: true });

// Health
const { pool } = require('./db');
app.get('/api/health', async (req, res) => {
  const start = Date.now();
  let dbOk = false;
  try { await pool.query('SELECT 1'); dbOk = true; } catch { dbOk = false; }
  const latency = Date.now() - start;
  if (masterHealthFn && (req.query.master === '1')) {
    try {
      const mh = await masterHealthFn(req.query.tenant_id);
      return res.json({ status: dbOk ? 'ok' : 'degraded', dbLatencyMs: latency, master: mh.master, tenant: mh.tenant, uptimeSeconds: process.uptime() });
    } catch (e) {
      return res.json({ status: dbOk ? 'ok' : 'degraded', dbLatencyMs: latency, master: false, error: e.message, uptimeSeconds: process.uptime() });
    }
  }
  res.json({ status: dbOk ? 'ok' : 'degraded', dbLatencyMs: latency, uptimeSeconds: process.uptime() });
});
app.get('/api/metrics', metricsEndpoint);

// Not found handler
app.use((req, res, next) => next(new AppError(404,'Ruta no encontrada','NOT_FOUND')));

// Error handler
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err instanceof AppError) {
    return res.status(err.status).json(errorResponse(err));
  }
  console.error('Unhandled error', { message: err.message, stack: err.stack });
  if (process.env.DEV_ERROR_DETAILS === '1') {
    return res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR', stack: err.stack });
  }
  res.status(500).json(errorResponse(new AppError(500,'Error interno','INTERNAL_ERROR')));
});


// Default port aligned with frontend Vite proxy target (vite.config.js -> target http://localhost:4100)
// Override with PORT env var if needed.
let basePort = parseInt(process.env.PORT,10) || 4100;
const strictPort = process.env.PORT_STRICT === '1';
function start(port, attempts=0){
  const srv = app.listen(port, () => {
    if (attempts>0 && !strictPort) console.log(`[SERVER] Usando puerto alternativo ${port}`);
    console.log(`Servidor corriendo en el puerto ${port}${strictPort ? ' (PORT_STRICT)' : ''}`);
  });
  srv.on('error', async (err)=>{
    if (err.code === 'EADDRINUSE') {
      if (strictPort) {
        // Verificar si el proceso que ocupa el puerto sigue vivo tras intento de steal
        let occupyingPids = [];
        try {
          const raw = require('child_process').execSync(`lsof -ti:${port}`, { stdio:['ignore','pipe','ignore'] }).toString().trim();
          occupyingPids = raw.split(/\s+/).filter(Boolean).map(n=>parseInt(n,10));
  } catch (e) { /* ignore readlink failures */ }
        if (occupyingPids.length === 1 && occupyingPids.includes(process.pid)) {
          console.warn(`[SERVER] Aviso: evento EADDRINUSE emitido pero el PID actual posee el puerto ${port}. Ignorando falso positivo.`);
          return; // no abortar
        }
        console.error(`[SERVER] PORT_STRICT=1 y el puerto ${port} está en uso por otros procesos (${occupyingPids.filter(p=>p!==process.pid).join(', ')||'desconocido'}). Abortando.`);
        process.exit(1);
      }
      if (attempts < 5) {
        console.warn(`[SERVER] Puerto ${port} en uso. Intentando ${port+1}...`);
        start(port+1, attempts+1);
        return;
      }
    }
    console.error('[SERVER] No se pudo iniciar el servidor:', err);
    process.exit(1);
  });
}
async function portInUse(port){
  return new Promise(resolve => {
    const tester = net.createServer()
      .once('error', err => {
        if (err.code === 'EADDRINUSE') return resolve(true);
        resolve(false);
      })
      .once('listening', () => tester.close(()=>resolve(false)))
      .listen(port, '0.0.0.0');
  });
}

async function maybeStealPort(port){
  if (process.env.PORT_STRICT !== '1') return; // only relevant in strict mode
  if (process.env.PORT_STRICT_STEAL !== '1') return; // opt-in
  const inUse = await portInUse(port);
  if (!inUse) return;
  let pidsRaw='';
  try { pidsRaw = execSync(`lsof -ti:${port}`, { stdio:['ignore','pipe','ignore'] }).toString().trim(); } catch { return; }
  if (!pidsRaw) return;
  const pids = [...new Set(pidsRaw.split(/\s+/).filter(Boolean))];
  for (const pid of pids){
    if (parseInt(pid,10) === process.pid) continue;
    try {
      const cwd = execSync(`readlink -f /proc/${pid}/cwd`, { stdio:['ignore','pipe','ignore'] }).toString().trim();
      if (cwd === process.cwd()) {
        console.warn(`[SERVER] PORT_STRICT_STEAL=1: Terminando proceso previo ${pid} en ${port}`);
        process.kill(parseInt(pid,10), 'SIGTERM');
      }
  } catch (e) { /* ignore maybeStealPort kill errors */ }
  }
  // breve espera a liberar socket
  await new Promise(r=>setTimeout(r, 800));
}

if (require.main === module) {
  (async ()=> {
    try { await maybeStealPort(basePort); } catch(e){ console.error('[SERVER] Error en maybeStealPort', e); }
    start(basePort);
  })();
}

module.exports = app;
