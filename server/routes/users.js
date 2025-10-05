const express = require('express');
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
  } catch (e) { console.error('Profile schema detection failed', e); }
  PROFILE_SCHEMA_DETECTED = true;
}

function activePool(req){ return req.tenantPool || pool; }

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
