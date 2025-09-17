require('dotenv').config();
const express = require('express');
const security = require('./middleware/security');
const requestId = require('./middleware/requestId');
const { httpLogger } = require('./logger');
const cors = require('cors');
const { AppError, errorResponse } = require('./utils/errors');
const { metricsMiddleware, metricsEndpoint } = require('./metrics');

const app = express();

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
  return allowedOriginMatchers.some(m => m.test(origin));
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
    if (corsDebug) console.warn('[CORS] reject', origin);
    return callback(new Error('CORS: origin not allowed'));
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

// Basic route
app.get('/', (req, res) => {
  res.send('API del Laboratorio funcionando!');
});

// Rutas Auth
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Rutas Pacientes
const patientRoutes = require('./routes/patients');
app.use('/api/patients', patientRoutes);

// Rutas Work Orders
const workOrderRoutes = require('./routes/workOrders');
app.use('/api/work-orders', workOrderRoutes);

// Rutas Usuarios (admin)
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Rutas Auditoría
const auditRoutes = require('./routes/audit');
app.use('/api/audit', auditRoutes);

// Rutas Marketing AI (placeholder)
const marketingRoutes = require('./routes/marketing');
app.use('/api/marketing', marketingRoutes);

// Roles (solo listado por ahora)
const rolesRoutes = require('./routes/roles');
app.use('/api/roles', rolesRoutes);

// Rutas Profiles (restaurada)
const profilesRoutes = require('./routes/profiles');
app.use('/api/profiles', profilesRoutes);

// Rutas dominio laboratorio adicionales
const analysisRoutes = require('./routes/analysis');
app.use('/api/analysis', analysisRoutes);
const referrersRoutes = require('./routes/referrers');
app.use('/api/referrers', referrersRoutes);
const packagesRoutes = require('./routes/packages');
app.use('/api/packages', packagesRoutes);
// AI assist
const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);
// Configuración laboratorio
const configRoutes = require('./routes/config');
const financeRoutes = require('./routes/finance');
app.use('/api/config', configRoutes);
app.use('/api/finance', financeRoutes);
// Parámetros del sistema
const parametersRoutes = require('./routes/parameters');
app.use('/api/parameters', parametersRoutes);
// Plantillas
const templatesRoutes = require('./routes/templates');
app.use('/api/templates', templatesRoutes);
// Sucursales
const branchesRoutes = require('./routes/branches');
app.use('/api/branches', branchesRoutes);

// Health
const { pool } = require('./db');
app.get('/api/health', async (_req, res) => {
  const start = Date.now();
  let dbOk = false;
  try { await pool.query('SELECT 1'); dbOk = true; } catch { dbOk = false; }
  const latency = Date.now() - start;
  res.json({ status: dbOk ? 'ok' : 'degraded', dbLatencyMs: latency, uptimeSeconds: process.uptime() });
});
app.get('/api/metrics', metricsEndpoint);

// Not found handler
app.use((req, res, next) => next(new AppError(404,'Ruta no encontrada','NOT_FOUND')));

// Error handler
// eslint-disable-next-line no-unused-vars
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
  srv.on('error', (err)=>{
    if (err.code === 'EADDRINUSE') {
      if (strictPort) {
        console.error(`[SERVER] PORT_STRICT=1 y el puerto ${port} está en uso. Abortando para mantener coherencia con frontend.`);
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
if (require.main === module) start(basePort);

module.exports = app;
