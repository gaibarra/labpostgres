const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');

const router = express.Router();
let NAMES_DETECTED=false; let USERS_HAS_FULL_NAME=false; let P_HAS_FULL=false; let P_HAS_FIRST_LAST=false; let P_HAS_USER_ID=false;
async function detectNameColumns(){
  if (NAMES_DETECTED) return;
  try {
    const [uFull, pFull, pFirst, pLast, pUser] = await Promise.all([
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name'"),
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='full_name'"),
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='first_name'"),
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_name'"),
      pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id'")
    ]);
    USERS_HAS_FULL_NAME = uFull.rowCount===1;
    P_HAS_FULL = pFull.rowCount===1;
    P_HAS_FIRST_LAST = pFirst.rowCount===1 && pLast.rowCount===1;
    P_HAS_USER_ID = pUser.rowCount===1;
  } catch(e){ console.error('detectNameColumns failed', e); }
  NAMES_DETECTED=true;
}

// Basic audit log table ensure (idempotent)
async function ensureAuditTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS system_audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      action text NOT NULL,
      details jsonb DEFAULT '{}'::jsonb,
      performed_by uuid,
      created_at timestamptz DEFAULT now()
    );`);
    // Handle legacy 'timestamp' column
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='system_audit_logs'`);
    const cols = rows.map(r=>r.column_name);
    if (!cols.includes('created_at') && cols.includes('timestamp')) {
      try { await pool.query('ALTER TABLE system_audit_logs RENAME COLUMN "timestamp" TO created_at'); } catch(_) {}
    }
    if (!cols.includes('entity')) {
      try { await pool.query('ALTER TABLE system_audit_logs ADD COLUMN entity text'); } catch(_) {}
    }
    if (!cols.includes('entity_id')) {
      try { await pool.query('ALTER TABLE system_audit_logs ADD COLUMN entity_id text'); } catch(_) {}
    }
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_action ON system_audit_logs(action)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_created ON system_audit_logs(created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_entity ON system_audit_logs(entity)');
  } catch(e) {
    console.error('Error ensuring audit table', e);
  }
}
ensureAuditTable();

router.post('/', auth, requirePermission('administration','view_audit_log'), async (req, res, next) => {
  const { action, details } = req.body || {};
  if (!action) return next(new AppError(400,'action requerido','ACTION_REQUIRED'));
  try {
    const { rows } = await pool.query(
      'INSERT INTO system_audit_logs(action, details, performed_by) VALUES($1,$2,$3) RETURNING *',
      [action, details || {}, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) { console.error(e); next(new AppError(500,'Error creando log','AUDIT_CREATE_FAIL')); }
});

router.get('/', auth, requirePermission('administration','view_audit_log'), async (req, res, next) => {
  try {
    const { search, from, to, user, actionPrefix, page='0', pageSize='20', all } = req.query;
    const limit = Math.min(parseInt(pageSize,10)||20, 2000);
    const offset = (parseInt(page,10)||0) * limit;
    const filters = []; const params = [];
    if (search) {
      params.push(`%${search}%`);
      filters.push(`(action ILIKE $${params.length} OR details::text ILIKE $${params.length})`);
    }
    if (from) { params.push(from); filters.push(`created_at >= $${params.length}`); }
    if (to) { params.push(to); filters.push(`created_at < $${params.length}`); }
    if (user) { params.push(user); filters.push(`performed_by = $${params.length}`); }
    if (actionPrefix) { params.push(actionPrefix + '%'); filters.push(`action ILIKE $${params.length}`); }
    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  await detectNameColumns();
  const profileJoin = P_HAS_USER_ID ? 'LEFT JOIN profiles p ON p.user_id = u.id' : 'LEFT JOIN profiles p ON p.id = u.id';
  const namePieces=[];
  if (USERS_HAS_FULL_NAME) namePieces.push('u.full_name');
  if (P_HAS_FULL) namePieces.push('p.full_name');
  if (P_HAS_FIRST_LAST) namePieces.push("(trim(COALESCE(p.first_name,'')||' '||COALESCE(p.last_name,'')))");
  if (!namePieces.length) namePieces.push('u.email');
  const nameExpr = `COALESCE(${namePieces.join(', ')})`;
  const baseSelect = `SELECT l.id, l.action, l.details, l.performed_by, l.created_at, COALESCE(l.created_at, now()) AS created_at_fallback, ${nameExpr} AS user_name FROM system_audit_logs l LEFT JOIN users u ON u.id = l.performed_by ${profileJoin} ${where}`;
    if (all === '1') {
      const { rows } = await pool.query(baseSelect + ' ORDER BY created_at_fallback DESC');
      return res.json({ items: rows.map(r=> ({ ...r, created_at: r.created_at || r.created_at_fallback })), total: rows.length });
    }
    const dataQ = baseSelect + ' ORDER BY created_at_fallback DESC LIMIT $' + (params.length+1) + ' OFFSET $' + (params.length+2);
    const countQ = 'SELECT COUNT(*)::int AS total FROM system_audit_logs l ' + (where ? where : '');
    const [dataR, countR] = await Promise.all([
      pool.query(dataQ, [...params, limit, offset]),
      pool.query(countQ, params)
    ]);
  res.json({ items: dataR.rows.map(r=> ({ ...r, created_at: r.created_at || r.created_at_fallback })), total: countR.rows[0].total, page: parseInt(page,10)||0, pageSize: limit });
  } catch (e) { console.error(e); next(new AppError(500,'Error listando logs','AUDIT_LIST_FAIL')); }
});

// Clear all logs (dangerous) – restricted permission reuse view_audit_log for now; could add separate permission
router.delete('/', auth, requirePermission('administration','view_audit_log'), async (_req,res,next)=>{
  try { await pool.query('TRUNCATE system_audit_logs'); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error limpiando logs','AUDIT_CLEAR_FAIL')); }
});

module.exports = router;
