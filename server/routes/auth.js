const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { add: blacklistAdd } = require('../services/tokenStore');

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
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'); // fallback
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
    await pool.query(sqlCreate);
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
        'orders', ARRAY['create','read_all','read_assigned','update_status','enter_results','validate_results','print_report','send_report'],
        'administration', ARRAY['manage_users','manage_roles','system_settings','view_audit_log'],
        'profiles', ARRAY['read']
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
    const { rows } = await pool.query(
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
      await pool.query('INSERT INTO profiles(id, user_id, email, full_name, role) VALUES(gen_random_uuid(),$1,$2,$3,$4)', [user.id, user.email, nameValue, effectiveRole]);
    } else if (PROFILE_HAS_USER_ID && PROFILE_HAS_FIRST_LAST) {
      const first = nameValue ? nameValue.split(' ')[0] : null;
      const last = nameValue ? nameValue.split(' ').slice(1).join(' ') || null : null;
      await pool.query('INSERT INTO profiles(id, user_id, email, first_name, last_name, role) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5)', [user.id, user.email, first, last, effectiveRole]);
    } else if (!PROFILE_HAS_USER_ID && PROFILE_HAS_FULL_NAME) {
      await pool.query('INSERT INTO profiles(id, email, full_name, role) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, full_name=EXCLUDED.full_name', [user.id, user.email, nameValue, effectiveRole]);
    } else if (!PROFILE_HAS_USER_ID && PROFILE_HAS_FIRST_LAST) {
      const first = nameValue ? nameValue.split(' ')[0] : null;
      const last = nameValue ? nameValue.split(' ').slice(1).join(' ') || null : null;
      await pool.query('INSERT INTO profiles(id, email, first_name, last_name, role) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name', [user.id, user.email, first, last, effectiveRole]);
    } else {
      // Fallback: attempt minimal insert with columns that exist (email only)
      try { await pool.query('INSERT INTO profiles(id, email, role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [user.id, user.email, effectiveRole]); } catch(_) {}
    }
    res.locals.newUserId = user.id;
  const token = jwt.sign({ id: user.id, email: user.email, role: effectiveRole }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '12h' });
  res.status(201).json({ user: { ...user, role: effectiveRole }, token });
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
    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    const user = rows[0];
  if (!user) return next(new AppError(401,'Credenciales inválidas','BAD_CREDENTIALS'));
    const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return next(new AppError(401,'Credenciales inválidas','BAD_CREDENTIALS'));
    let role = 'Invitado';
    if (PROFILE_HAS_USER_ID) {
      const { rows: profileRows } = await pool.query('SELECT role FROM profiles WHERE user_id=$1', [user.id]);
      if (profileRows[0]?.role) role = profileRows[0].role; else {
        const { rows: alt } = await pool.query('SELECT role FROM profiles WHERE id=$1', [user.id]);
        if (alt[0]?.role) role = alt[0].role;
      }
    } else {
      const { rows: profileRows } = await pool.query('SELECT role FROM profiles WHERE id=$1', [user.id]);
      role = profileRows[0]?.role || role;
    }
    const token = jwt.sign({ id: user.id, email: user.email, role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '12h' });
  res.json({ user: { id: user.id, email: user.email, full_name: user.full_name, created_at: user.created_at, role }, token });
  } catch (e) {
  if (process.env.DEBUG_AUTH) console.error('[LOGIN_ERROR]', { message: e.message, code: e.code, stack: e.stack });
  else console.error(e);
    next(new AppError(500,'Error iniciando sesión','LOGIN_FAIL'));
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    // Construir dinámicamente columnas existentes para evitar errores de columnas inexistentes
    const profileCols = [];
    if (PROFILE_HAS_FULL_NAME) profileCols.push('p.full_name AS profile_full_name');
    if (PROFILE_HAS_FIRST_LAST) profileCols.push('p.first_name', 'p.last_name');
    const profileColsSql = profileCols.length ? ', ' + profileCols.join(', ') : '';
    const joinCondition = PROFILE_HAS_USER_ID ? 'p.user_id=u.id' : 'p.id=u.id';
    const sql = `SELECT u.id, u.email, u.full_name, u.created_at, p.role${profileColsSql} FROM users u LEFT JOIN profiles p ON ${joinCondition} WHERE u.id=$1`;
    const { rows } = await pool.query(sql, [req.user.id]);
    if (!rows[0]) return next(new AppError(404,'Usuario no encontrado','USER_NOT_FOUND'));
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
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.decode(token);
    if (decoded?.exp) blacklistAdd(token, decoded.exp);
    res.json({ success: true });
  } catch (e) { next(new AppError(500,'Error cerrando sesión','LOGOUT_FAIL')); }
});

module.exports = router;
