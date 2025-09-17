const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Permitir desactivar o ajustar rate limiting en desarrollo/local
const isDev = process.env.NODE_ENV !== 'production' || process.env.TEST_MODE === '1';
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10) || (15 * 60 * 1000);
const MAX_REQUESTS = process.env.RATE_LIMIT_MAX
  ? (process.env.RATE_LIMIT_MAX.toLowerCase() === 'infinite' ? Infinity : parseInt(process.env.RATE_LIMIT_MAX, 10))
  : (isDev ? Infinity : 500);

const securityMiddleware = [
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }),
  // Si MAX_REQUESTS es Infinity, no instalamos el rate limiter
  ...(Number.isFinite(MAX_REQUESTS) ? [rateLimit({
    windowMs: WINDOW_MS,
    max: MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false
  })] : [])
];

module.exports = securityMiddleware;
