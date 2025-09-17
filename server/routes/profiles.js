const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
const { parsePagination } = require('../utils/pagination');

const router = express.Router();

// List profiles (admin)
router.get('/', auth, requirePermission('profiles', 'read'), async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const colInfo = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='profiles'");
    const cols = colInfo.rows.map((r) => r.column_name);
    const hasUserId = cols.includes('user_id');
    const hasFullName = cols.includes('full_name');
    const hasFirst = cols.includes('first_name');
    const hasLast = cols.includes('last_name');
    const selectName = hasFullName
      ? 'full_name'
      : (hasFirst || hasLast)
        ? "COALESCE(first_name,'') || CASE WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN ' ' ELSE '' END || COALESCE(last_name,'') AS full_name"
        : "NULL::text AS full_name";
    const userIdCol = hasUserId ? 'user_id' : 'NULL::uuid AS user_id';
    const baseColsSql = userIdCol.replace(' AS user_id', '');
    const sql = `SELECT id, ${baseColsSql}, email, ${selectName}, role, created_at FROM profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
    const { rows } = await pool.query(sql, [limit, offset]);
    const out = rows.map((r) => ({ id: r.id, user_id: hasUserId ? r.user_id : r.id, email: r.email, full_name: r.full_name, role: r.role, created_at: r.created_at }));
    res.json(out);
  } catch (e) {
    console.error(e);
    next(new AppError(500, 'Error listando perfiles', 'PROFILE_LIST_FAIL'));
  }
});

router.get('/:id', auth, requirePermission('profiles', 'read'), async (req, res, next) => {
  try {
    const colInfo = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='profiles'");
    const cols = colInfo.rows.map((r) => r.column_name);
    const hasUserId = cols.includes('user_id');
    const hasFullName = cols.includes('full_name');
    const hasFirst = cols.includes('first_name');
    const hasLast = cols.includes('last_name');
    const selectName = hasFullName
      ? 'full_name'
      : (hasFirst || hasLast)
        ? "COALESCE(first_name,'') || CASE WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN ' ' ELSE '' END || COALESCE(last_name,'') AS full_name"
        : "NULL::text AS full_name";
    const userIdCol = hasUserId ? 'user_id' : 'NULL::uuid AS user_id';
    const baseColsSql = userIdCol.replace(' AS user_id', '');
    const sql = `SELECT id, ${baseColsSql}, email, ${selectName}, role, created_at FROM profiles WHERE id=$1`;
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows[0]) return next(new AppError(404, 'Perfil no encontrado', 'PROFILE_NOT_FOUND'));
    const r = rows[0];
    res.json({ id: r.id, user_id: hasUserId ? r.user_id : r.id, email: r.email, full_name: r.full_name, role: r.role, created_at: r.created_at });
  } catch (e) {
    console.error(e);
    next(new AppError(500, 'Error obteniendo perfil', 'PROFILE_GET_FAIL'));
  }
});

// Helpers for theme persistence
async function ensureThemeColumn(client) {
  const colInfo = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='theme'"
  );
  if (colInfo.rowCount === 0) {
    try {
      await client.query('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text');
    } catch (_) {
      // ignore
    }
  }
}

async function hasUserIdColumn(client) {
  const q = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id'");
  return q.rowCount === 1;
}

async function ensureProfileRow(user, client) {
  if (!user?.id) return;
  const hasUID = await hasUserIdColumn(client);
  if (hasUID) {
    // Ensure row keyed by user_id exists; avoid touching email to bypass unique(email) conflicts
    await client.query(
      `INSERT INTO public.profiles (id, user_id, role)
       VALUES (gen_random_uuid(), $1, COALESCE($2,''))
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, user.role || null]
    );
    // Optional gentle alignment: if there is a row by email without user_id, attach it (only if no existing row for this user_id)
    if (user.email) {
      await client.query(
        `UPDATE public.profiles p
         SET user_id=$1
         WHERE p.email=$2 AND (p.user_id IS NULL OR p.user_id=$1)
           AND NOT EXISTS (SELECT 1 FROM public.profiles x WHERE x.user_id=$1 AND x.id<>p.id)`,
        [user.id, user.email]
      );
    }
  } else {
    // Legacy schema where profiles.id == auth.users.id
    await client.query(
      `INSERT INTO public.profiles (id, role)
       VALUES ($1, COALESCE($2, ''))
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.role || null]
    );
  }
}

// GET my theme
router.get('/me/theme', auth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    // Set claims for session (not LOCAL) so each statement sees it
    const claims = { sub: req.user.id, role: req.user.role || null, email: req.user.email || null };
    const claimsStr = JSON.stringify(claims).replace(/'/g, "''");
    await client.query(`SELECT set_config('request.jwt.claims', '${claimsStr}', false)`);
    await ensureThemeColumn(client);
    await ensureProfileRow(req.user, client);
    const hasUID = await hasUserIdColumn(client);
    const col = hasUID ? 'user_id' : 'id';
    let { rows } = await client.query(`SELECT theme FROM public.profiles WHERE ${col}=$1`, [req.user.id]);
    if ((!rows || rows.length === 0 || rows[0].theme == null) && req.user.email) {
      // Fallback by email for legacy rows
      const alt = await client.query('SELECT theme FROM public.profiles WHERE email=$1', [req.user.email]);
      if (alt.rowCount > 0) rows = alt.rows;
    }
    res.json({ theme: rows?.[0]?.theme ?? null });
  } catch (e) {
    console.error('[profiles:/me/theme GET] error', e.code || e.name, e.message);
    next(new AppError(500, 'Error obteniendo tema', 'PROFILE_THEME_GET_FAIL'));
  } finally {
    // Reset claims for this session
    try { await client.query("SELECT set_config('request.jwt.claims','',false)"); } catch {}
    client.release();
  }
});

// PUT my theme
router.put('/me/theme', auth, async (req, res, next) => {
  const { theme } = req.body || {};
  if (theme && !['light', 'dark'].includes(theme)) return next(new AppError(400, 'Tema inválido', 'PROFILE_THEME_VALIDATION'));
  const client = await pool.connect();
  try {
    const claims = { sub: req.user.id, role: req.user.role || null, email: req.user.email || null };
  const claimsStr = JSON.stringify(claims).replace(/'/g, "''");
  await client.query(`SELECT set_config('request.jwt.claims', '${claimsStr}', false)`);
  await ensureThemeColumn(client);
  await ensureProfileRow(req.user, client);
    const hasUID = await hasUserIdColumn(client);
    const col = hasUID ? 'user_id' : 'id';
    let result = await client.query(`UPDATE public.profiles SET theme=$2 WHERE ${col}=$1 RETURNING theme`, [req.user.id, theme || null]);
    if (!result.rows[0]) {
      try {
        if (hasUID) {
          await client.query(
            `INSERT INTO public.profiles (id, user_id, email, role, theme)
             VALUES (gen_random_uuid(), $1, $2, COALESCE($3, ''), $4)
             ON CONFLICT (user_id) DO UPDATE SET theme=EXCLUDED.theme`,
            [req.user.id, req.user.email || null, req.user.role || null, theme || null]
          );
          result = await client.query('SELECT theme FROM public.profiles WHERE user_id=$1', [req.user.id]);
        } else {
          await client.query(
            `INSERT INTO public.profiles (id, email, role, theme)
             VALUES ($1, $2, COALESCE($3, ''), $4)
             ON CONFLICT (id) DO UPDATE SET theme=EXCLUDED.theme`,
            [req.user.id, req.user.email || null, req.user.role || null, theme || null]
          );
          result = await client.query('SELECT theme FROM public.profiles WHERE id=$1', [req.user.id]);
        }
      } catch (_) {}
    }
    if (!result.rows[0]) return next(new AppError(404, 'Perfil no encontrado', 'PROFILE_NOT_FOUND'));
    res.json({ theme: result.rows[0].theme });
  } catch (e) {
  console.error('[profiles:/me/theme PUT] error', e.code || e.name, e.message);
  next(new AppError(500, 'Error guardando tema', 'PROFILE_THEME_SAVE_FAIL'));
  } finally {
  try { await client.query("SELECT set_config('request.jwt.claims','',false)"); } catch {}
    client.release();
  }
});

module.exports = router;
