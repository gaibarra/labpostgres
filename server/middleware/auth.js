const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');
const { isBlacklisted, isJtiBlacklisted } = require('../services/tokenStore');
const { incVersionMismatch, incJtiBlacklistHit } = require('../metrics');
const { pool } = require('../db');

async function authMiddleware(req, _res, next) {
  // Prioridad: Authorization Bearer, fallback cookie auth_token
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const parts = authHeader.split(' ');
    if (parts.length === 2) token = parts[1]; else return next(new AppError(401, 'Formato de autorización inválido', 'AUTH_FORMAT'));
  }
  if (!token && req.cookies && req.cookies.auth_token) token = req.cookies.auth_token;
  if (!token) return next(new AppError(401, 'Falta token', 'AUTH_MISSING'));
  if (await isBlacklisted(token)) return next(new AppError(401, 'Token revocado', 'TOKEN_REVOKED'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    // Validar jti blacklist (si presente)
    if (payload.jti && await isJtiBlacklisted(payload.jti)) {
      incJtiBlacklistHit();
      return next(new AppError(401, 'Token revocado', 'TOKEN_REVOKED'));
    }
    // Validar versión de token del usuario (si columna existe y payload incluye tv)
    if (payload.id && typeof payload.tv !== 'undefined') {
      try {
        const { rows } = await pool.query('SELECT token_version FROM users WHERE id=$1', [payload.id]);
        if (rows[0]?.token_version && rows[0].token_version !== payload.tv) {
          incVersionMismatch();
          return next(new AppError(401, 'Token desactualizado', 'TOKEN_VERSION_MISMATCH'));
        }
      } catch(_) { /* ignorar silenciosamente para no bloquear si no existe columna */ }
    }
  req.user = payload;
  // Ensure id populated (some tokens may use sub instead of id)
  if (!req.user.id && req.user.sub) req.user.id = req.user.sub;
  // Normalizar rol (trim y capitalización estándar para Administrador)
  if (req.user.role) {
    req.user.role = String(req.user.role).trim();
    if (req.user.role.toLowerCase() === 'administrador') req.user.role = 'Administrador';
  } else {
    req.user.role = '';
  }
  // Exponer también en req.auth para middleware multi-tenant (consistencia con tenantResolver expectation)
  req.auth = payload;
    req.authToken = token; // almacenar el token crudo para revocación posterior en logout
    next();
  } catch (e) {
    return next(new AppError(401, 'Token no válido', 'TOKEN_INVALID'));
  }
}

// Alias for clarity in routes
const requireAuth = authMiddleware;

module.exports = authMiddleware;
module.exports.requireAuth = requireAuth;

