const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');
const { isBlacklisted } = require('../services/tokenStore');

async function authMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next(new AppError(401, 'Falta token', 'AUTH_MISSING'));
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return next(new AppError(401, 'Formato de autorización inválido', 'AUTH_FORMAT'));
  const token = parts[1];
  if (await isBlacklisted(token)) return next(new AppError(401, 'Token revocado', 'TOKEN_REVOKED'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = payload; // { id, email }
    next();
  } catch (e) {
    return next(new AppError(401, 'Token no válido', 'TOKEN_INVALID'));
  }
}

// Alias for clarity in routes
const requireAuth = authMiddleware;

module.exports = authMiddleware;
module.exports.requireAuth = requireAuth;

