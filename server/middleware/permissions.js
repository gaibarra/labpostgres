const { pool: basePool } = require('../db');
const { AppError } = require('../utils/errors');

// Cache de permisos por tenantId (o 'default')
const TTL_MS = 60_000; // 1 min
const permsCache = new Map(); // key -> { ts, data(Map) }

async function loadPermissions(key, activePool) {
  const now = Date.now();
  const entry = permsCache.get(key);
  if (entry && now - entry.ts < TTL_MS) return entry.data;
  const { rows } = await activePool.query('SELECT role_name, permissions FROM roles_permissions');
  const map = new Map(rows.map(r => [r.role_name, r.permissions || {}]));
  permsCache.set(key, { ts: now, data: map });
  return map;
}

function requirePermission(module, action) {
  return async (req, res, next) => {
    try {
  if (!req.user) return next(new AppError(401,'No autenticado','UNAUTHENTICATED'));
      // Prefer role embedded in JWT (added at login/register)
      const activePool = req.tenantPool || basePool;
      const tenantKey = req.auth?.tenant_id || 'default';
      let role = (req.user.role ? String(req.user.role).trim() : '') || 'Invitado';
      if (role.toLowerCase() === 'administrador') role = 'Administrador';
      if (!req.user.role) {
        // fetch role from profile (support both schemas: user_id or id)
        const colCheck = await activePool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id'");
        if (colCheck.rowCount === 1) {
          const { rows } = await activePool.query('SELECT role FROM profiles WHERE user_id=$1', [req.user.id]);
          if (rows[0]?.role) role = rows[0].role; else {
            // Fallback for legacy rows inserted before user_id existed
            const { rows: rows2 } = await activePool.query('SELECT role FROM profiles WHERE id=$1', [req.user.id]);
            role = rows2[0]?.role || role;
          }
        } else {
          const { rows } = await activePool.query('SELECT role FROM profiles WHERE id=$1', [req.user.id]);
          role = rows[0]?.role || role;
        }
        if (role && role.toLowerCase() === 'administrador') role = 'Administrador';
      }
      req.user.role = role; // cache on request
  if (role === 'Administrador') return next();
  const permsMap = await loadPermissions(tenantKey, activePool);
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
