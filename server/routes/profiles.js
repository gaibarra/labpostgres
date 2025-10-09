const express = require('express');
const { pool } = require('../db'); // global fallback
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
const { parsePagination } = require('../utils/pagination');

const router = express.Router();

// List profiles (admin)
router.get('/', auth, requirePermission('profiles', 'read'), async (req, res, next) => {
  try {
  const activePool = req.tenantPool || pool;
    const { limit, offset } = parsePagination(req.query);
  const colInfo = await activePool.query("SELECT column_name FROM information_schema.columns WHERE table_name='profiles'");
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
  const { rows } = await activePool.query(sql, [limit, offset]);
    const out = rows.map((r) => ({ id: r.id, user_id: hasUserId ? r.user_id : r.id, email: r.email, full_name: r.full_name, role: r.role, created_at: r.created_at }));
    res.json(out);
  } catch (e) {
    console.error(e);
    next(new AppError(500, 'Error listando perfiles', 'PROFILE_LIST_FAIL'));
  }
});

router.get('/:id', auth, requirePermission('profiles', 'read'), async (req, res, next) => {
  try {
  const activePool = req.tenantPool || pool;
  const colInfo = await activePool.query("SELECT column_name FROM information_schema.columns WHERE table_name='profiles'");
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
  const { rows } = await activePool.query(sql, [req.params.id]);
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

async function ensurePgcrypto(client) {
  try { await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto'); } catch(e){ /* ignore pgcrypto create errors */ }
}

async function ensureProfilesTable(client) {
  const t = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles'");
  if (t.rowCount === 0) {
    try {
      await ensurePgcrypto(client);
      await client.query(`CREATE TABLE public.profiles (
        id uuid PRIMARY KEY,
        user_id uuid UNIQUE,
        email text UNIQUE,
        full_name text,
        first_name text,
        last_name text,
        role text,
        theme text,
        created_at timestamptz DEFAULT now()
      );`);
      await client.query('CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id)');
    } catch(e) {
      // If creation fails for some reason, log but don't crash; downstream will still 500 with clearer context
      console.error('[profiles] ensureProfilesTable create failed', e.code || e.name, e.message);
    }
  }
}

async function ensureAuthUidFunction(client) {
  // Redefine stub so auth.uid() returns the sub claim, enabling RLS policies expecting id = auth.uid()
  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS auth");
    await client.query(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE plpgsql STABLE AS $$
      DECLARE sub text; v uuid; BEGIN
        sub := current_setting('request.jwt.claims', true)::json ->> 'sub';
        IF sub IS NOT NULL AND sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          BEGIN
            v := sub::uuid; RETURN v;
          EXCEPTION WHEN others THEN RETURN NULL; END;
        END IF;
        RETURN NULL; END;$$;`);
  } catch(e) {
    console.error('[profiles] ensureAuthUidFunction failed', e.code || e.name, e.message);
  }
}

async function extendProfilesPolicies(client) {
  try {
    await client.query(`DO $$BEGIN
    -- Drop existing policies to replace with versions that also accept user_id=auth.uid()
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_self_or_admin') THEN
      EXECUTE 'DROP POLICY profiles_select_self_or_admin ON profiles';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_self_or_admin') THEN
      EXECUTE 'DROP POLICY profiles_update_self_or_admin ON profiles';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_insert_self') THEN
      EXECUTE 'DROP POLICY profiles_insert_self ON profiles';
    END IF;
    EXECUTE $p$CREATE POLICY profiles_select_self_or_admin ON profiles FOR SELECT USING (
      (id = auth.uid() OR (CURRENT_SETTING('request.jwt.claims', true)::json ->> 'sub')::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id') AND user_id = auth.uid()) OR is_admin()
    )$p$;
    EXECUTE $p$CREATE POLICY profiles_insert_self ON profiles FOR INSERT WITH CHECK (
      id = auth.uid() OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id') AND user_id = auth.uid())
    )$p$;
    EXECUTE $p$CREATE POLICY profiles_update_self_or_admin ON profiles FOR UPDATE USING (
      (id = auth.uid() OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id') AND user_id = auth.uid())) OR is_admin()
    ) WITH CHECK (
      (id = auth.uid() OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id') AND user_id = auth.uid())) OR is_admin()
    )$p$;
    END$$;`);
  } catch(e) {
    console.error('[profiles] extendProfilesPolicies failed', e.code || e.name, e.message);
  }
}

async function hasUserIdColumn(client) {
  const q = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id'");
  return q.rowCount === 1;
}

async function hasUserIdUnique(client) {
  // Detect a unique or primary constraint covering user_id (not partial)
  const sql = `SELECT 1
               FROM pg_constraint c
               JOIN pg_class t ON t.oid=c.conrelid
               JOIN pg_namespace n ON n.oid=t.relnamespace
               WHERE n.nspname='public' AND t.relname='profiles'
                 AND c.contype IN ('u','p') AND array_position(c.conkey, (
                   SELECT attnum FROM pg_attribute a
                   WHERE a.attrelid=t.oid AND a.attname='user_id'
                 )) IS NOT NULL`;
  const r = await client.query(sql);
  if (r.rowCount) return true;
  // Fallback: look for a unique index directly
  const idx = await client.query(`SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='profiles' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(user_id%'`);
  return idx.rowCount > 0;
}

async function ensureProfileRow(user, client) {
  if (!user?.id) return;
  const hasUID = await hasUserIdColumn(client);
  const uidUnique = hasUID ? await hasUserIdUnique(client) : false;
  if (hasUID) {
    // Ensure row keyed by user_id exists; avoid touching email to bypass unique(email) conflicts
    if (uidUnique) {
      await client.query(
        `INSERT INTO public.profiles (id, user_id, role)
         VALUES ($1, $1, COALESCE($2,''))
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, user.role || null]
      );
    } else {
      // Fallback to id conflict if user_id not unique yet
      await client.query(
        `INSERT INTO public.profiles (id, user_id, role)
         VALUES ($1, $1, COALESCE($2,''))
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.role || null]
      );
    }
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

async function collectProfileConflictInfo(client, user) {
  const info = { emailRows: [], userRows: [] };
  try {
    if (user?.email) {
      const r1 = await client.query(
        'SELECT id, user_id, email, theme, role, created_at FROM public.profiles WHERE email=$1 LIMIT 10',
        [user.email]
      );
      info.emailRows = r1.rows;
    }
    if (user?.id) {
      const r2 = await client.query(
        'SELECT id, user_id, email, theme, role, created_at FROM public.profiles WHERE user_id=$1 OR id=$1 LIMIT 10',
        [user.id]
      );
      info.userRows = r2.rows;
    }
  } catch (e) {
    info.collectError = { code: e.code, message: e.message };
  }
  return info;
}

// GET my theme
router.get('/me/theme', auth, async (req, res, next) => {
  const p = req.tenantPool || pool;
  const client = await p.connect();
  try {
    // Set claims for session (not LOCAL) so each statement sees it
    const claims = { sub: req.user.id, role: req.user.role || null, email: req.user.email || null };
    const claimsStr = JSON.stringify(claims).replace(/'/g, "''");
    await client.query(`SELECT set_config('request.jwt.claims', '${claimsStr}', false)`);
  await ensureAuthUidFunction(client);
  await ensurePgcrypto(client); // harmless if already present
  await ensureProfilesTable(client);
  await extendProfilesPolicies(client);
    await ensureThemeColumn(client);
    await ensureProfileRow(req.user, client);
    const hasUID = await hasUserIdColumn(client);
  const _col = hasUID ? 'user_id' : 'id';
  let { rows } = await client.query(`SELECT theme FROM public.profiles WHERE ${_col}=$1`, [req.user.id]);
    if ((!rows || rows.length === 0 || rows[0].theme == null) && req.user.email) {
      // Fallback by email for legacy rows
      const alt = await client.query('SELECT theme FROM public.profiles WHERE email=$1', [req.user.email]);
  if (alt.rowCount > 0) rows = alt.rows;
    }
  res.json({ theme: rows?.[0]?.theme ?? null });
  } catch (e) {
  console.error('[profiles:theme GET] error', e.code || e.name, e.message);
    if (req.query.debug === '1') {
      return res.status(500).json({ error:'debug', code:e.code || e.name, message:e.message, detail:e.detail });
    }
    if (e.code === '42501') return next(new AppError(500, 'Acceso denegado (RLS)', 'PROFILE_THEME_RLS_DENIED'));
    if (e.code === '42P01') return next(new AppError(500, 'Tabla profiles inexistente', 'PROFILE_THEME_NO_TABLE'));
    if (e.code === '22P02') return next(new AppError(500, 'sub JWT no es UUID válido', 'PROFILE_THEME_SUB_INVALID'));
    next(new AppError(500, 'Error obteniendo tema', 'PROFILE_THEME_GET_FAIL'));
  } finally {
    // Reset claims for this session
  try { await client.query("SELECT set_config('request.jwt.claims','',false)"); } catch(e){ /* ignore reset claims */ }
    client.release();
  }
});

// PUT my theme
router.put('/me/theme', auth, async (req, res, next) => {
  const { theme } = req.body || {};
  if (theme && !['light', 'dark'].includes(theme)) return next(new AppError(400, 'Tema inválido', 'PROFILE_THEME_VALIDATION'));
  const p = req.tenantPool || pool;
  const client = await p.connect();
  const diag = { step: 'init', userId: req.user?.id, role: req.user?.role, email: req.user?.email, incomingTheme: theme || null };
  try {
    const claims = { sub: req.user.id, role: req.user.role || null, email: req.user.email || null };
  const claimsStr = JSON.stringify(claims).replace(/'/g, "''");
  await client.query(`SELECT set_config('request.jwt.claims', '${claimsStr}', false)`);
  diag.step = 'auth_claims_set';
  await ensureAuthUidFunction(client);
  diag.step = 'auth_uid_ready';
  await ensurePgcrypto(client);
  diag.step = 'pgcrypto_ready';
  await ensureProfilesTable(client);
  diag.step = 'profiles_table_ready';
  await extendProfilesPolicies(client);
  diag.step = 'policies_extended';
  await ensureThemeColumn(client);
  diag.step = 'theme_column_ready';
  await ensureProfileRow(req.user, client);
  diag.step = 'profile_row_ready';
    const hasUID = await hasUserIdColumn(client);
    const uidUnique = hasUID ? await hasUserIdUnique(client) : false;
  const _col = hasUID ? 'user_id' : 'id';
    // Unified idempotent UPSERT: always set id = user.id
    let upsertSql;
    let upsertVariant = 'legacy_id_only';
    if (hasUID && uidUnique) {
      upsertSql = `INSERT INTO public.profiles (id, user_id, email, role, theme)
                   VALUES ($1, $1, $2, COALESCE($3,''), $4)
                   ON CONFLICT (user_id) DO UPDATE SET theme=EXCLUDED.theme, email=COALESCE(public.profiles.email, EXCLUDED.email)`;
      upsertVariant = 'user_id_unique_conflict_user_id';
    } else if (hasUID && !uidUnique) {
      // fallback to id conflict until uniqueness added
      upsertSql = `INSERT INTO public.profiles (id, user_id, email, role, theme)
                   VALUES ($1, $1, $2, COALESCE($3,''), $4)
                   ON CONFLICT (id) DO UPDATE SET theme=EXCLUDED.theme, email=COALESCE(public.profiles.email, EXCLUDED.email)`;
      upsertVariant = 'user_id_present_conflict_id';
    } else {
      upsertSql = `INSERT INTO public.profiles (id, email, role, theme)
                   VALUES ($1, $2, COALESCE($3,''), $4)
                   ON CONFLICT (id) DO UPDATE SET theme=EXCLUDED.theme, email=COALESCE(public.profiles.email, EXCLUDED.email)`;
    }
    Object.assign(diag, { hasUID, uidUnique, upsertVariant });
    try {
      await client.query(upsertSql, [req.user.id, req.user.email || null, req.user.role || null, theme || null]);
      diag.step = 'upsert_done';
    } catch(eUp) {
      if (eUp.code === '23505' && req.user.email) {
  // unique conflict, attempt merge by email
        if (process.env.THEME_DEBUG === '1') console.error('[profiles:theme PUT][23505] unique conflict pre-merge', { code: eUp.code, detail: eUp.detail, constraint: eUp.constraint, diag });
        // Attempt to update existing email row (legacy row) to have this id (legacy schema) and/or just set theme
        if (!hasUID) {
          try {
            const _merge = await client.query(
              `UPDATE public.profiles SET id=$1, theme=$3, role=COALESCE(role, COALESCE($4,''))
               WHERE email=$2 RETURNING theme`,
              [req.user.id, req.user.email, theme || null, req.user.role || null]
            );
            // merge by email attempted
            diag.step = 'legacy_merge_email_update';
          } catch(eMerge) {
            console.error('[profiles:theme PUT] merge email fail', eMerge.code, eMerge.message);
            throw eMerge; // rethrow so outer catch handles
          }
        } else {
          // For user_id schema, just update theme by email if row exists without user_id and then retry insert
          try {
            await client.query(
              `UPDATE public.profiles SET user_id=$1, id=$1, theme=$3
               WHERE email=$2 AND (user_id IS NULL OR user_id=$1)`,
              [req.user.id, req.user.email, theme || null]
            );
            diag.step = 'user_id_email_attach_attempt';
            try {
              await client.query(upsertSql, [req.user.id, req.user.email || null, req.user.role || null, theme || null]);
              diag.step = 'retry_upsert_after_email_attach';
            } catch (eRetry) {
              if (eRetry.code === '23505') {
                diag.step = 'email_conflict_persistent';
                diag.conflict = await collectProfileConflictInfo(client, req.user);
                // Mark a special flag so outer handler can map a clearer error code
                diag.specialCode = 'EMAIL_OWNERSHIP_CONFLICT';
              }
              throw eRetry; // propagate
            }
          } catch(eMerge2) {
            console.error('[profiles:theme PUT] merge email user_id fail', eMerge2.code, eMerge2.message);
            throw eMerge2;
          }
        }
      } else {
        if (process.env.THEME_DEBUG === '1') console.error('[profiles:theme PUT] upsert immediate fail', { code: eUp.code, message: eUp.message, detail: eUp.detail, diag });
        throw eUp;
      }
    }
    const selectSql = hasUID ? 'SELECT theme FROM public.profiles WHERE user_id=$1' : 'SELECT theme FROM public.profiles WHERE id=$1';
    const result = await client.query(selectSql, [req.user.id]);
    if (!result.rows[0]) return next(new AppError(404, 'Perfil no encontrado', 'PROFILE_NOT_FOUND'));
    res.json({ theme: result.rows[0].theme });
  } catch (e) {
  diag.error = { code: e.code, message: e.message, detail: e.detail, constraint: e.constraint };
  if (process.env.THEME_DEBUG === '1') console.error('[profiles:theme PUT] error extended', { diag });
  else console.error('[profiles:theme PUT] error', e.code || e.name, e.message);
  const persistentEmailConflict = diag.specialCode === 'EMAIL_OWNERSHIP_CONFLICT';
  if (req.query.debug === '1') {
    return res.status(500).json({ error:'debug', code: persistentEmailConflict ? 'EMAIL_OWNERSHIP_CONFLICT' : (e.code || e.name), message:e.message, detail:e.detail, diag });
  }
  if (e.code === '42501') return next(new AppError(500, 'Acceso denegado (RLS)', 'PROFILE_THEME_RLS_DENIED'));
  if (e.code === '42P01') return next(new AppError(500, 'Tabla profiles inexistente', 'PROFILE_THEME_NO_TABLE'));
  if (e.code === '22P02') return next(new AppError(500, 'sub JWT no es UUID válido', 'PROFILE_THEME_SUB_INVALID'));
  if (persistentEmailConflict) return next(new AppError(500, 'Email pertenece a otro perfil (conflicto)', 'PROFILE_THEME_EMAIL_CONFLICT'));
  next(new AppError(500, 'Error guardando tema', 'PROFILE_THEME_SAVE_FAIL'));
  } finally {
  try { await client.query("SELECT set_config('request.jwt.claims','',false)"); } catch(e){ /* ignore reset claims */ }
    client.release();
  }
});


module.exports = router;
