const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');

const router = express.Router();

// Cache profile schema detection (similar approach as auth route)
let PROFILE_SCHEMA_DETECTED = false;
let PROFILE_HAS_USER_ID = false;
let PROFILE_HAS_FULL_NAME = false;
let PROFILE_HAS_FIRST_LAST = false;
let PROFILE_USER_ID_UNIQUE = false;
async function detectProfileSchema() {
  if (PROFILE_SCHEMA_DETECTED) return;
  try {
    const [userIdCol, fullCol, firstCol, lastCol] = await Promise.all([
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id'"),
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='full_name'"),
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='first_name'"),
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_name'")
    ]);
    PROFILE_HAS_USER_ID = userIdCol.rowCount === 1;
    PROFILE_HAS_FULL_NAME = fullCol.rowCount === 1;
    PROFILE_HAS_FIRST_LAST = firstCol.rowCount === 1 && lastCol.rowCount === 1;
    if (PROFILE_HAS_USER_ID) {
      const uniqueUserId = await pool.query(`
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (c.conkey)
        WHERE rel.relname = 'profiles'
          AND att.attname = 'user_id'
          AND c.contype IN ('p','u','x')
        LIMIT 1
      `);
      PROFILE_USER_ID_UNIQUE = uniqueUserId.rowCount === 1;
    } else {
      PROFILE_USER_ID_UNIQUE = false;
    }
  } catch (e) { console.error('Profile schema detection failed', e); }
  PROFILE_SCHEMA_DETECTED = true;
}

function activePool(req){ return req.tenantPool || pool; }

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function buildFullName(first, last) {
  return [first, last].map(part => (part || '').trim()).filter(Boolean).join(' ') || null;
}

async function upsertProfile(req, { userId, email, firstName, lastName, role }) {
  await detectProfileSchema();
  const client = activePool(req);
  const updates = [];
  const values = [];
  let idx = 1;
  if (PROFILE_HAS_FULL_NAME) {
    updates.push(`full_name=$${idx++}`);
    values.push(buildFullName(firstName, lastName));
  }
  if (PROFILE_HAS_FIRST_LAST) {
    updates.push(`first_name=$${idx++}`);
    values.push(firstName || null);
    updates.push(`last_name=$${idx++}`);
    values.push(lastName || null);
  }
  if (role) {
    updates.push(`role=$${idx++}`);
    values.push(role);
  }
  const whereColumn = PROFILE_HAS_USER_ID ? 'user_id' : 'id';
  const updateSql = updates.length ? `UPDATE profiles SET ${updates.join(', ')} WHERE ${whereColumn}=$${idx}` : null;
  if (updateSql) {
    const updated = await client.query(updateSql, [...values, userId]);
    if (updated.rowCount > 0) return;
  }
  // Insert fallback if update didn't affect any row
  const cols = [];
  const placeholders = [];
  const insertVals = [];
  let p = 1;
  if (PROFILE_HAS_USER_ID) {
    cols.push('id');
    placeholders.push('gen_random_uuid()');
    cols.push('user_id');
    placeholders.push(`$${p++}`);
    insertVals.push(userId);
  } else {
    cols.push('id');
    placeholders.push(`$${p++}`);
    insertVals.push(userId);
  }
  cols.push('email');
  placeholders.push(`$${p++}`);
  insertVals.push(email);
  if (PROFILE_HAS_FULL_NAME) {
    cols.push('full_name');
    placeholders.push(`$${p++}`);
    insertVals.push(buildFullName(firstName, lastName));
  }
  if (PROFILE_HAS_FIRST_LAST) {
    cols.push('first_name');
    placeholders.push(`$${p++}`);
    insertVals.push(firstName || null);
    cols.push('last_name');
    placeholders.push(`$${p++}`);
    insertVals.push(lastName || null);
  }
  cols.push('role');
  placeholders.push(`$${p++}`);
  insertVals.push(role || 'Invitado');
  const valuesExpression = placeholders.join(', ');
  const conflictAssignments = ['role=EXCLUDED.role'];
  if (PROFILE_HAS_FULL_NAME) {
    conflictAssignments.push('full_name=COALESCE(EXCLUDED.full_name, profiles.full_name)');
  }
  if (PROFILE_HAS_FIRST_LAST) {
    conflictAssignments.push('first_name=COALESCE(EXCLUDED.first_name, profiles.first_name)');
    conflictAssignments.push('last_name=COALESCE(EXCLUDED.last_name, profiles.last_name)');
  }
  let insertSql;
  const canUseConflict = !PROFILE_HAS_USER_ID || PROFILE_USER_ID_UNIQUE;
  if (canUseConflict) {
    const conflictColumn = PROFILE_HAS_USER_ID ? 'user_id' : 'id';
    insertSql = `INSERT INTO profiles(${cols.join(', ')}) VALUES(${valuesExpression}) ON CONFLICT (${conflictColumn}) DO UPDATE SET ${conflictAssignments.join(', ')}`;
  } else {
    insertSql = `INSERT INTO profiles(${cols.join(', ')}) SELECT ${valuesExpression} WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE ${whereColumn}=$${p++})`;
    insertVals.push(userId);
  }
  try {
    await client.query(insertSql, insertVals);
  } catch (err) {
    if (err.code === '23505') {
      // Retry update in case of race
      if (updateSql) {
        await client.query(updateSql, [...values, userId]);
        return;
      }
    }
    throw err;
  }
}

// List users (administration) aislado por tenant (cada tenantPool apunta a su base)
router.get('/', auth, requirePermission('administration','manage_users'), async (req, res, next) => {
  try {
    await detectProfileSchema();
    const joinCondition = PROFILE_HAS_USER_ID ? 'p.user_id = u.id' : 'p.id = u.id';
    const cols = ['u.id','u.email','u.created_at','p.role'];
    if (PROFILE_HAS_FULL_NAME) cols.push('p.full_name');
    if (PROFILE_HAS_FIRST_LAST) { cols.push('p.first_name','p.last_name'); }
  const sql = `SELECT ${cols.join(', ')} FROM users u LEFT JOIN profiles p ON ${joinCondition} ORDER BY u.created_at ASC`;
  const { rows } = await activePool(req).query(sql);
    const normalized = rows.map(r => {
      let first = r.first_name || null;
      let last = r.last_name || null;
      if (!first && !last && r.full_name) {
        const parts = r.full_name.trim().split(/\s+/);
        first = parts[0] || null;
        last = parts.slice(1).join(' ') || null;
      }
      return { id: r.id, email: r.email, role: r.role || 'Invitado', first_name: first, last_name: last };
    });
    res.json(normalized);
  } catch (e) {
    console.error('[users list] error', e);
    next(new AppError(500,'Error listando usuarios','USERS_LIST_FAIL'));
  }
});

router.post('/', auth, requirePermission('administration','manage_users'), async (req, res, next) => {
  try {
    await detectProfileSchema();
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password || '';
    const firstName = (req.body?.first_name || '').trim();
    const lastName = (req.body?.last_name || '').trim();
    const role = req.body?.role || 'Invitado';
    if (!email) return next(new AppError(400,'Email requerido','EMAIL_REQUIRED'));
    if (!password || password.length < 6) return next(new AppError(400,'La contraseña debe tener al menos 6 caracteres','PASSWORD_TOO_SHORT'));
    if (!firstName || !lastName) return next(new AppError(400,'Nombre y apellido son obligatorios','NAME_REQUIRED'));
    const hash = await bcrypt.hash(password, 10);
    const client = activePool(req);
    const insertUser = await client.query(
      'INSERT INTO users(email, password_hash, full_name) VALUES($1,$2,$3) RETURNING id, email, created_at',
      [email, hash, buildFullName(firstName, lastName)]
    ).catch(err => {
      if (err.code === '23505') throw new AppError(409,'El email ya existe','EMAIL_EXISTS');
      throw err;
    });
    const user = insertUser.rows[0];
    await upsertProfile(req, { userId: user.id, email, firstName, lastName, role });
    res.status(201).json({ id: user.id, email: user.email, role, first_name: firstName, last_name: lastName, created_at: user.created_at });
  } catch (e) {
    if (e instanceof AppError) return next(e);
    console.error('[users create] error', e);
    next(new AppError(500,'Error creando usuario','USER_CREATE_FAIL'));
  }
});

router.put('/:id', auth, requirePermission('administration','manage_users'), async (req, res, next) => {
  try {
    await detectProfileSchema();
    const userId = req.params.id;
    const firstName = req.body?.first_name?.trim?.() || '';
    const lastName = req.body?.last_name?.trim?.() || '';
    const role = req.body?.role || null;
    if (!firstName && !lastName && !role) return next(new AppError(400,'No hay cambios para aplicar','NO_UPDATE_FIELDS'));
    const client = activePool(req);
    const userRes = await client.query('SELECT id, email FROM users WHERE id=$1 LIMIT 1', [userId]);
    if (!userRes.rows[0]) return next(new AppError(404,'Usuario no encontrado','USER_NOT_FOUND'));
    if (firstName || lastName) {
      await client.query('UPDATE users SET full_name=$1 WHERE id=$2', [buildFullName(firstName, lastName), userId]);
    }
    await upsertProfile(req, { userId, email: userRes.rows[0].email, firstName, lastName, role });
    const joinCondition = PROFILE_HAS_USER_ID ? 'p.user_id=u.id' : 'p.id=u.id';
    const cols = ['u.id','u.email','p.role'];
    if (PROFILE_HAS_FIRST_LAST) cols.push('p.first_name','p.last_name');
    if (PROFILE_HAS_FULL_NAME) cols.push('p.full_name');
    const { rows } = await client.query(`SELECT ${cols.join(', ')} FROM users u LEFT JOIN profiles p ON ${joinCondition} WHERE u.id=$1`, [userId]);
    const row = rows[0];
    res.json({
      id: row.id,
      email: row.email,
      role: row.role || role || 'Invitado',
      first_name: row.first_name || (row.full_name ? row.full_name.split(' ')[0] : null) || firstName || null,
      last_name: row.last_name || (row.full_name ? row.full_name.split(' ').slice(1).join(' ') : null) || lastName || null
    });
  } catch (e) {
    if (e instanceof AppError) return next(e);
    console.error('[users update] error', e);
    next(new AppError(500,'Error actualizando usuario','USER_UPDATE_FAIL'));
  }
});

// Simple admin check placeholder: in future use roles table / permissions
async function isAdmin(userId, req) {
  try {
    const { rows } = await activePool(req).query('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
    return rows[0] && rows[0].id === userId;
  } catch {
    return false;
  }
}

// Delete user (migrated from supabase function delete-user)
router.delete('/:id', auth, requirePermission('administration','manage_users'), async (req, res, next) => {
  try {
  // Admin fallback dentro del tenant actual
  if (!(await isAdmin(req.user.id, req))) return next(new AppError(403,'No autorizado','NOT_ADMIN'));
    const userId = req.params.id;
    // Remove any profile references if you later create profiles table
  await activePool(req).query('DELETE FROM users WHERE id=$1', [userId]);
    res.json({ success: true });
  } catch (e) { console.error(e); next(new AppError(500,'Error eliminando usuario','USER_DELETE_FAIL')); }
});

module.exports = router;
