const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
function activePool(req){ return req.tenantPool || pool; }
// Master DB (multi-tenant) optional: if MULTI_TENANT=1 use master for auth lookups
let masterPool = null;
if (process.env.MULTI_TENANT === '1') {
  try {
    const { Pool } = require('pg');
    masterPool = new Pool({
      host: process.env.MASTER_PGHOST || process.env.PGHOST,
      port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
      user: process.env.MASTER_PGUSER || process.env.PGUSER,
      password: process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD,
      database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master',
      max: 5,
      idleTimeoutMillis: 30000
    });
  } catch(e) {
    console.error('[AUTH] No se pudo inicializar masterPool:', e.message);
  }
}
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { add: blacklistAdd, registerActiveToken, blacklistJti, revokeActive } = require('../services/tokenStore');
const { incRevocation } = require('../metrics');

const router = express.Router();
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');

// Ensure users & profiles tables exist (supports legacy profiles variants)
let PROFILE_HAS_USER_ID = false;
let PROFILE_HAS_FULL_NAME = false;
let PROFILE_HAS_FIRST_LAST = false;
async function ensureAuthStructures() {
  try {
    // Garantizar extensiones para UUID si no existen (evita 500 si falta gen_random_uuid)
  const ap = pool; // extensiones sólo en plantilla/base principal
  await ap.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  await ap.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'); // fallback
  } catch (extErr) {
    if (process.env.DEBUG_AUTH_INIT) console.warn('[AUTH INIT] No se pudieron crear extensiones UUID (puede no ser superuser):', extErr.code || extErr.message);
  }
  try {
    // Detect available UUID function (prefers gen_random_uuid, fallback uuid_generate_v4)
    let uuidFn = 'gen_random_uuid()';
    try {
      const fx = await pool.query("SELECT proname FROM pg_proc WHERE proname='gen_random_uuid' LIMIT 1");
      if (fx.rowCount === 0) {
        const fx2 = await pool.query("SELECT proname FROM pg_proc WHERE proname='uuid_generate_v4' LIMIT 1");
        if (fx2.rowCount === 0) uuidFn = null; else uuidFn = 'uuid_generate_v4()';
      }
    } catch(_) {}
    if (!uuidFn) {
      // As last resort generate in application layer for inserts (no default) but keep column uuid
      if (process.env.DEBUG_AUTH_INIT) console.warn('[AUTH INIT] Ninguna función UUID disponible; se usará generación en aplicación');
    }
    const usersDefault = uuidFn ? `DEFAULT ${uuidFn}` : '';
    const sqlCreate = `
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY ${usersDefault},
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        full_name text,
        token_version integer DEFAULT 1,
        created_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email_ci ON users (LOWER(email));

      CREATE TABLE IF NOT EXISTS profiles (
        id uuid PRIMARY KEY ${usersDefault},
        email text UNIQUE,
        full_name text,
        role text DEFAULT 'Invitado',
        created_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_profiles_email_ci ON profiles(LOWER(email));

      CREATE TABLE IF NOT EXISTS roles_permissions (
        id uuid PRIMARY KEY ${usersDefault},
        role_name text NOT NULL,
        permissions jsonb DEFAULT '{}'::jsonb,
        is_system_role boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_roles_permissions_role ON roles_permissions(role_name);
    `;
  await pool.query(sqlCreate); // estructuras base en pool principal (no por-tenant aquí)
  } catch (tblErr) {
    // Si falla por ausencia de gen_random_uuid intentar recrear usando uuid_generate_v4
    const needsFallback = /gen_random_uuid/i.test(tblErr.message || '');
    if (needsFallback) {
      try {
        if (process.env.DEBUG_AUTH_INIT) console.log('[AUTH INIT] Reintentando creación de tablas usando uuid_generate_v4()');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            email text UNIQUE NOT NULL,
            password_hash text NOT NULL,
            full_name text,
            token_version integer DEFAULT 1,
            created_at timestamptz DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_users_email_ci ON users (LOWER(email));

          CREATE TABLE IF NOT EXISTS profiles (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            email text UNIQUE,
            full_name text,
            role text DEFAULT 'Invitado',
            created_at timestamptz DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_profiles_email_ci ON profiles(LOWER(email));

          CREATE TABLE IF NOT EXISTS roles_permissions (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            role_name text NOT NULL,
            permissions jsonb DEFAULT '{}'::jsonb,
            is_system_role boolean DEFAULT false,
            created_at timestamptz DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_roles_permissions_role ON roles_permissions(role_name);
        `);
      } catch (fallbackErr) {
        console.error('[AUTH INIT] Falla al crear tablas de auth (fallback)', fallbackErr);
        throw fallbackErr; // dejar que se registre en catch exterior
      }
    } else {
      throw tblErr;
    }
  }
  // Add user_id column if missing
  // Ensure token_version column
  try {
    const tv = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='token_version'");
    if (tv.rowCount === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN token_version integer DEFAULT 1");
    }
  } catch(_) {}

  const col = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id'");
  if (col.rowCount === 0) {
    try { await pool.query("ALTER TABLE profiles ADD COLUMN user_id uuid UNIQUE"); } catch(_) {}
  }
  // FK if not exists
  try {
    const fk = await pool.query("SELECT 1 FROM pg_constraint WHERE conname='profiles_user_id_fkey'");
    if (fk.rowCount === 0) {
      await pool.query("ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE");
    }
  } catch(_) {}
  PROFILE_HAS_USER_ID = (await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id'")).rowCount===1;
  PROFILE_HAS_FULL_NAME = (await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='full_name'")).rowCount===1;
  const firstCol = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='first_name'");
  const lastCol = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_name'");
  PROFILE_HAS_FIRST_LAST = firstCol.rowCount===1 && lastCol.rowCount===1;
  // Seed minimal roles if empty
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM roles_permissions');
  if (rows[0].count === 0) {
    await pool.query(`
      INSERT INTO roles_permissions (role_name, permissions, is_system_role) VALUES
      ('Administrador', jsonb_build_object(
        'patients', ARRAY['create','read','update','delete'],
        'referrers', ARRAY['create','read','update','delete','manage_pricelists'],
        'studies', ARRAY['create','read','update','delete'],
        'packages', ARRAY['create','read','update','delete'],
        'orders', ARRAY['create','read_all','enter_results','update_status','validate_results','print_report','send_report'],
        'administration', ARRAY['manage_users','manage_roles','system_settings','view_audit_log'],
        'profiles', ARRAY['read']
      ), true),
      ('Recepcionista', jsonb_build_object(
        'patients', ARRAY['create','read','update'],
        'referrers', ARRAY['read'],
        'studies', ARRAY['read'],
        'orders', ARRAY['create','read_all','update_status','print_report','send_report']
      ), true),
      ('Laboratorista', jsonb_build_object(
        'patients', ARRAY['read'],
        'orders', ARRAY['read_all','enter_results','update_status']
      ), true),
      ('Invitado', '{}'::jsonb, true);
    `);
  }
}
// Mantener una sola promesa de inicialización para evitar condiciones de carrera.
let authInitPromise = null;
function initAuthOnce(){
  if (!authInitPromise) {
    authInitPromise = ensureAuthStructures().catch(e => {
      console.error('[AUTH INIT] fallo inicialización', e);
      // Si falla, permitir reintentos en próxima solicitud
      authInitPromise = null;
      throw e;
    });
  }
  return authInitPromise;
}

// Middleware que garantiza que las estructuras estén listas antes de cualquier handler (/register, /login, etc.)
router.use(async (_req, _res, next) => {
  try { await initAuthOnce(); } catch (e) { /* el error se registró arriba */ }
  next();
});

router.post('/register', validate(registerSchema), audit('register','auth_user', (req,r)=>r.locals?.newUserId, (req)=>({ email: req.body?.email })), async (req, res, next) => {
  const { email, password, full_name, role } = req.body || {};
  if (process.env.DEBUG_PERMS) console.log('REGISTER_BODY_ROLE', role, req.body);
  if (!email || !password) return next(new AppError(400,'Email y password requeridos','MISSING_FIELDS'));
  try {
    const hash = await bcrypt.hash(password, 10);
  const { rows } = await activePool(req).query(
      'INSERT INTO users(email, password_hash, full_name) VALUES($1,$2,$3) RETURNING id, email, full_name, created_at',
      [email, hash, full_name || null]
    );
  const user = rows[0];
  if (process.env.DEBUG_PERMS) console.log('NEW_USER', user);
    // create profile depending on schema variant
  const effectiveRole = (role && role.toLowerCase()==='administrador') ? 'Administrador' : (role || 'Invitado');
  if (process.env.DEBUG_PERMS) console.log('EFFECTIVE_ROLE', effectiveRole, { PROFILE_HAS_USER_ID, PROFILE_HAS_FULL_NAME, PROFILE_HAS_FIRST_LAST });
    const nameValue = user.full_name || full_name || null;
    if (PROFILE_HAS_USER_ID && PROFILE_HAS_FULL_NAME) {
      // Determine if profiles.id is independent (has default) or equals users.id (no user_id schema). We just insert with user_id and let default id generate.
  await activePool(req).query('INSERT INTO profiles(id, user_id, email, full_name, role) VALUES(gen_random_uuid(),$1,$2,$3,$4)', [user.id, user.email, nameValue, effectiveRole]);
    } else if (PROFILE_HAS_USER_ID && PROFILE_HAS_FIRST_LAST) {
      const first = nameValue ? nameValue.split(' ')[0] : null;
      const last = nameValue ? nameValue.split(' ').slice(1).join(' ') || null : null;
  await activePool(req).query('INSERT INTO profiles(id, user_id, email, first_name, last_name, role) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5)', [user.id, user.email, first, last, effectiveRole]);
    } else if (!PROFILE_HAS_USER_ID && PROFILE_HAS_FULL_NAME) {
  await activePool(req).query('INSERT INTO profiles(id, email, full_name, role) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, full_name=EXCLUDED.full_name', [user.id, user.email, nameValue, effectiveRole]);
    } else if (!PROFILE_HAS_USER_ID && PROFILE_HAS_FIRST_LAST) {
      const first = nameValue ? nameValue.split(' ')[0] : null;
      const last = nameValue ? nameValue.split(' ').slice(1).join(' ') || null : null;
  await activePool(req).query('INSERT INTO profiles(id, email, first_name, last_name, role) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name', [user.id, user.email, first, last, effectiveRole]);
    } else {
      // Fallback: attempt minimal insert with columns that exist (email only)
  try { await activePool(req).query('INSERT INTO profiles(id, email, role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [user.id, user.email, effectiveRole]); } catch(_) {}
    }
    res.locals.newUserId = user.id;
  const jti = (Date.now().toString(36) + Math.random().toString(36).slice(2,10));
  const token = jwt.sign({ id: user.id, email: user.email, role: effectiveRole, jti, tv: 1 }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '12h' });
  try { const decoded = jwt.decode(token); if (decoded?.exp) registerActiveToken({ jti, userId: user.id, exp: decoded.exp, tokenVersion: 1 }); } catch(_) {}
  res.status(201).json({ user: { ...user, role: effectiveRole, token_version: 1 }, token });
  } catch (e) {
    if (e.code === '23505') return next(new AppError(409,'Email ya registrado','EMAIL_EXISTS'));
    console.error(e);
    next(new AppError(500,'Error registrando usuario','REGISTER_FAIL'));
  }
});

router.post('/login', validate(loginSchema), audit('login','auth_user', req=>req.body?.email || null, (req)=>({ email: req.body?.email })), async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return next(new AppError(400,'Email y password requeridos','MISSING_FIELDS'));
  try {
  // Multi-tenant: buscar credenciales en master si habilitado
  let rows;
  let tenantId = null;
  if (masterPool) {
    // master users table expected: tenant_admins or a view; fallback to users in tenant DB if not found
    try {
      const r = await masterPool.query('SELECT ta.id, ta.email, ta.password_hash, ta.tenant_id, 1 as token_version, now() as created_at FROM tenant_admins ta WHERE LOWER(ta.email)=LOWER($1) LIMIT 1', [email]);
      rows = r.rows;
      if (rows[0]) tenantId = rows[0].tenant_id;
      if (process.env.DEBUG_AUTH) console.log('[LOGIN][MASTER_MATCH]', { email, tenantId, found: !!rows[0] });
    } catch (e) {
      console.warn('[AUTH][MT] fallo consulta tenant_admins, usando tabla users tenant:', e.message);
    }
  }
  if (!rows || rows.length === 0) {
  const r2 = await activePool(req).query('SELECT id, email, password_hash, full_name, token_version, created_at FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    rows = r2.rows;
    if (process.env.DEBUG_AUTH) console.log('[LOGIN][TENANT_FALLBACK]', { email, found: !!rows[0] });
  }
    const user = rows[0];
  if (!user) return next(new AppError(401,'Credenciales inválidas','BAD_CREDENTIALS'));
    const ok = await bcrypt.compare(password, user.password_hash);
  if (process.env.DEBUG_AUTH) console.log('[LOGIN][PWD_CHECK]', { email, ok });
  if (!ok) return next(new AppError(401,'Credenciales inválidas','BAD_CREDENTIALS'));
    // Si es login vía master (tenant admin), sincronizar usuario dentro del tenant antes de emitir token.
    let effectiveUserId = user.id; // se reemplazará por el id en el tenant si aplica
    let role = 'Invitado';
    if (tenantId) {
      try {
        const { getTenantPool } = require('../services/tenantResolver');
        const tPool = await getTenantPool(tenantId);
        // Buscar usuario en tenant
        const tUserRes = await tPool.query('SELECT id, email, full_name, token_version, created_at FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
        if (tUserRes.rows.length === 0) {
          // Crear usuario en tenant (full_name opcional desde master si existiera)
          const inserted = await tPool.query(
            'INSERT INTO users(email, password_hash, full_name) VALUES($1,$2,$3) RETURNING id, email, full_name, token_version, created_at',
            [email, user.password_hash, user.full_name || null]
          );
          effectiveUserId = inserted.rows[0].id;
          // Crear perfil con rol Administrador por defecto (owner)
          if (PROFILE_HAS_USER_ID) {
            await tPool.query('INSERT INTO profiles(id, user_id, email, full_name, role) VALUES(gen_random_uuid(),$1,$2,$3,$4)', [effectiveUserId, email, user.full_name || email, 'Administrador']);
          } else {
            await tPool.query('INSERT INTO profiles(id, email, full_name, role) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [effectiveUserId, email, user.full_name || email, 'Administrador']);
          }
          role = 'Administrador';
        } else {
          const tUser = tUserRes.rows[0];
            effectiveUserId = tUser.id;
            // Obtener rol de perfil
            if (PROFILE_HAS_USER_ID) {
              const pr = await tPool.query('SELECT role FROM profiles WHERE user_id=$1', [effectiveUserId]);
              role = pr.rows[0]?.role || 'Administrador';
            } else {
              const pr = await tPool.query('SELECT role FROM profiles WHERE id=$1', [effectiveUserId]);
              role = pr.rows[0]?.role || 'Administrador';
            }
        }
      } catch (syncErr) {
        console.warn('[AUTH][MT] No se pudo sincronizar usuario en tenant', syncErr.message);
        role = 'Administrador'; // fallback generoso para no bloquear
      }
    } else {
      // Camino single-tenant existente
      if (PROFILE_HAS_USER_ID) {
        const { rows: profileRows } = await activePool(req).query('SELECT role FROM profiles WHERE user_id=$1', [user.id]);
        if (profileRows[0]?.role) role = profileRows[0].role; else {
          const { rows: alt } = await activePool(req).query('SELECT role FROM profiles WHERE id=$1', [user.id]);
          if (alt[0]?.role) role = alt[0].role;
        }
      } else {
        const { rows: profileRows } = await activePool(req).query('SELECT role FROM profiles WHERE id=$1', [user.id]);
        role = profileRows[0]?.role || role;
      }
    }
  const jti = (Date.now().toString(36) + Math.random().toString(36).slice(2,10));
  const payload = { id: effectiveUserId, email: user.email, role, jti, tv: user.token_version };
  if (tenantId) payload.tenant_id = tenantId;
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '12h' });
    // Emitir cookie httpOnly adicional (fase de transición: mantenemos respuesta JSON con token por compatibilidad)
    try {
      const prod = process.env.NODE_ENV === 'production';
      res.cookie('auth_token', token, {
        httpOnly: true,
        sameSite: prod ? 'lax' : 'lax',
        secure: prod, // sólo en https en producción
        maxAge: 12 * 60 * 60 * 1000, // 12h
        path: '/',
      });
    } catch(cookieErr) {
      if (process.env.DEBUG_AUTH) console.warn('[LOGIN] no se pudo establecer cookie', cookieErr.message);
    }
  try { const decoded = jwt.decode(token); if (decoded?.exp) registerActiveToken({ jti, userId: user.id, exp: decoded.exp, tokenVersion: user.token_version }); } catch(_) {}
  res.json({ user: { id: payload.id, email: user.email, full_name: user.full_name, created_at: user.created_at, role, token_version: user.token_version, tenant_id: tenantId }, token });
  } catch (e) {
  // Logging detallado si DEBUG_AUTH
  if (process.env.DEBUG_AUTH) console.error('[LOGIN_ERROR]', { message: e.message, code: e.code, stack: e.stack });
  else console.error('[LOGIN_ERROR]', e.message);
  // Causas comunes: credenciales DB incorrectas, tabla users inexistente, columna faltante, password_hash nulo
  const devDetails = (process.env.NODE_ENV !== 'production' && (process.env.DEV_ERROR_DETAILS === '1' || process.env.DEBUG_AUTH));
  if (devDetails) {
    return res.status(500).json({ error: 'LOGIN_FAIL', message: e.message, code: e.code || null });
  }
  next(new AppError(500,'Error iniciando sesión','LOGIN_FAIL'));
  }
});

// Ruta diagnóstica opcional para inspeccionar columnas de users/profiles (habilitar con DEBUG_AUTH_DIAG=1)
if (process.env.DEBUG_AUTH_DIAG === '1') {
  router.get('/_diag/login-columns', async (_req, res) => {
    try {
      const usersCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
      const profilesCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='profiles' ORDER BY ordinal_position");
      res.json({ users: usersCols.rows.map(r=>r.column_name), profiles: profilesCols.rows.map(r=>r.column_name) });
    } catch (e) {
      res.status(500).json({ error: 'DIAG_FAIL', message: e.message });
    }
  });
}

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    // Construir dinámicamente columnas existentes para evitar errores de columnas inexistentes
    const profileCols = [];
    if (PROFILE_HAS_FULL_NAME) profileCols.push('p.full_name AS profile_full_name');
    if (PROFILE_HAS_FIRST_LAST) profileCols.push('p.first_name', 'p.last_name');
    const profileColsSql = profileCols.length ? ', ' + profileCols.join(', ') : '';
    const joinCondition = PROFILE_HAS_USER_ID ? 'p.user_id=u.id' : 'p.id=u.id';
    const sql = `SELECT u.id, u.email, u.full_name, u.created_at, p.role${profileColsSql} FROM users u LEFT JOIN profiles p ON ${joinCondition} WHERE u.id=$1`;
  const { rows } = await activePool(req).query(sql, [req.user.id]);
    if (!rows[0]) {
      if (process.env.AUTH_ME_DEBUG === '1') {
        console.warn('[AUTH/ME][USER_NOT_FOUND]', {
          userId: req.user?.id || null,
          tenantInfo: {
            hasTenantPool: !!req.tenantPool,
            tenantId: req.auth?.tenant_id || req.auth?.tenantId || null
          }
        });
      }
      return next(new AppError(404,'Usuario no encontrado','USER_NOT_FOUND'));
    }
    const row = rows[0];
    let fullNameOut = row.full_name;
    if (!fullNameOut) {
      if (row.profile_full_name) fullNameOut = row.profile_full_name;
      else if (row.first_name || row.last_name) fullNameOut = [row.first_name, row.last_name].filter(Boolean).join(' ') || null;
    }
    res.json({ user: { id: row.id, email: row.email, full_name: fullNameOut, created_at: row.created_at, role: row.role } });
  } catch (e) {
    console.error('[auth/me] error', e);
    next(new AppError(500,'Error obteniendo usuario','ME_FAIL'));
  }
});

router.post('/logout', authMiddleware, audit('logout','auth_token', req=>req.user?.id), async (req, res, next) => {
  try {
    // Siempre intentar revocar el token usado (Bearer o cookie) gracias a req.authToken
    const token = req.authToken;
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.exp) blacklistAdd(token, decoded.exp);
        if (decoded?.jti && decoded?.exp) { blacklistJti(decoded.jti, decoded.exp); revokeActive(decoded.jti); }
        incRevocation('logout');
      } catch(_) {}
    }
    // Limpiar cookie si estaba presente
    try { res.clearCookie('auth_token', { path: '/' }); } catch(_) {}
    res.json({ success: true, loggedOut: true, revoked: Boolean(token) });
  } catch (e) { next(new AppError(500,'Error cerrando sesión','LOGOUT_FAIL')); }
});

module.exports = router;
