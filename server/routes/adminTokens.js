const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { listActiveTokens, blacklistJti, revokeActive } = require('../services/tokenStore');
const { incRevocation } = require('../metrics');

const router = express.Router();

// Simple helper role check (extend if you add granular perms)
function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'Administrador') return next(new AppError(403,'Requiere rol Administrador','FORBIDDEN'));
  next();
}

// GET /api/auth/admin/tokens?userId=optional
router.get('/tokens', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.query;
    const list = await listActiveTokens(userId || null);
    res.json({ tokens: list });
  } catch (e) { next(new AppError(500,'Error listando tokens','TOKENS_LIST_FAIL')); }
});

// POST /api/auth/admin/tokens/revoke { jti }
router.post('/tokens/revoke', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { jti } = req.body || {};
    if (!jti) return next(new AppError(400,'jti requerido','MISSING_JTI'));
    // Forzamos blacklist sin conocer exp exacto (usamos TTL corto si no existe active entry)
    // En un escenario ideal primero se consultaría token activo para obtener exp
    revokeActive(jti);
    // Blacklist jti con TTL mínimo (60s) si no estaba (a falta de exp real)
    const expFallback = Math.floor(Date.now()/1000) + 60;
    blacklistJti(jti, expFallback);
  incRevocation('admin_manual');
  res.json({ revoked: true, jti });
  } catch (e) { next(new AppError(500,'Error revocando token','TOKEN_REVOKE_FAIL')); }
});

module.exports = router;
