const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');
const { isBlacklisted } = require('../services/tokenStore');

// Middleware drop-in que intenta extraer el token primero de Authorization Bearer y luego de la cookie auth_token
module.exports = function authCookie(req, _res, next) {
  try {
    let token = null;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) token = auth.split(' ')[1];
    if (!token && req.cookies && req.cookies.auth_token) token = req.cookies.auth_token;
    if (!token) return next(new AppError(401,'No autenticado','NO_AUTH'));
    if (isBlacklisted(token)) return next(new AppError(401,'Token revocado','TOKEN_REVOKED'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') return next(new AppError(401,'Token expirado','TOKEN_EXPIRED'));
    next(new AppError(401,'Token inválido','BAD_TOKEN'));
  }
};
