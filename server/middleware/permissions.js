const { pool } = require('../db');
const { AppError } = require('../utils/errors');

// Cache roles permissions in-memory (simple) with TTL
let cache = { data: null, ts: 0 };
const TTL_MS = 60_000; // 1 min

async function loadPermissions() {
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL_MS) return cache.data;
  const { rows } = await pool.query('SELECT role_name, permissions FROM roles_permissions');
  const map = new Map(rows.map(r => [r.role_name, r.permissions || {}]));
  cache = { data: map, ts: now };
  return map;
}

function requirePermission(module, action) {
  return async (req, res, next) => {
    try {
  if (!req.user) return next(new AppError(401,'No autenticado','UNAUTHENTICATED'));
      // Prefer role embedded in JWT (added at login/register)
      let role = req.user.role || 'Invitado';
      if (!req.user.role) {
        // fetch role from profile (support both schemas: user_id or id)
        const colCheck = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id'");
        if (colCheck.rowCount === 1) {
          const { rows } = await pool.query('SELECT role FROM profiles WHERE user_id=$1', [req.user.id]);
          if (rows[0]?.role) role = rows[0].role; else {
            // Fallback for legacy rows inserted before user_id existed
            const { rows: rows2 } = await pool.query('SELECT role FROM profiles WHERE id=$1', [req.user.id]);
            role = rows2[0]?.role || role;
          }
        } else {
          const { rows } = await pool.query('SELECT role FROM profiles WHERE id=$1', [req.user.id]);
          role = rows[0]?.role || role;
        }
      }
      req.user.role = role; // cache on request
  if (role === 'Administrador') return next();
  const permsMap = await loadPermissions();
  if (process.env.DEBUG_PERMS) {
    console.log('PERM_CHECK', { uid: req.user.id, role, module, action, hasRoleEntry: permsMap.has(role) });
  }
  const rolePerms = permsMap.get(role) || {};
  if (rolePerms[module] && rolePerms[module].includes(action)) return next();
  return next(new AppError(403,'Permiso denegado','FORBIDDEN'));
    } catch (e) {
  console.error('Permission check error', e);
  return next(new AppError(500,'Error verificación permisos','PERMISSION_CHECK_ERROR'));
    }
  };
}

module.exports = { requirePermission };
