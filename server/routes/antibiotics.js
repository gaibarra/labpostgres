const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');

const router = express.Router();
function activePool(req){ return req.tenantPool || pool; }

// Introspect presence of antibiotics table (cache per-process, refreshable)
let _hasAntibioticsTable = null;
async function ensureAntibioticsTable(req){
  if (_hasAntibioticsTable !== null) return _hasAntibioticsTable;
  try {
    const { rows } = await activePool(req).query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='antibiotics'
    `);
    _hasAntibioticsTable = rows.length > 0;
  } catch (e) {
    _hasAntibioticsTable = false;
  }
  return _hasAntibioticsTable;
}

// GET /api/antibiotics
// Query params: q, class, active(true/false), page(default 1), pageSize(default 50, max 200), sort(name|code, default name)
router.get('/', auth, requirePermission('studies','read'), async (req,res,next)=>{
  try {
    const has = await ensureAntibioticsTable(req);
    if (!has) return res.status(200).json({ count: 0, total: 0, page: 1, pageSize: 50, items: [] });
    const ap = activePool(req);
    const q = (req.query.q||'').toString().trim();
    const cls = (req.query.class||'').toString().trim();
    const active = req.query.active == null ? null : (/^(1|true|t|yes|y)$/i.test(String(req.query.active)) ? true : (/^(0|false|f|no|n)$/i.test(String(req.query.active)) ? false : null));
    const page = Math.max(1, parseInt(req.query.page,10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize,10) || 50));
    const sort = (req.query.sort||'name').toString().toLowerCase();
    const sortCol = sort === 'code' ? 'code' : 'name';

    const where = [];
    const params = [];
    if (q) { params.push(`%${q}%`); where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`); }
    if (cls) { params.push(cls); where.push(`class = $${params.length}`); }
    if (active !== null) { params.push(active); where.push(`is_active = $${params.length}`); }
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    const { rows: cnt } = await ap.query(`SELECT COUNT(*)::int AS total FROM antibiotics ${whereSql}`, params);
    const total = cnt[0]?.total || 0;
    const offset = (page-1)*pageSize;
    params.push(pageSize, offset);
    const { rows } = await ap.query(
      `SELECT id, code, name, class, is_active, synonyms, updated_at
       FROM antibiotics ${whereSql}
       ORDER BY ${sortCol} ASC
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    return res.json({ count: rows.length, total, page, pageSize, items: rows });
  } catch (e) {
    console.error('[ANTIBIOTICS_LIST_FAIL]', e);
    return next(new AppError(500,'Error listando antibióticos','ANTIBIOTICS_LIST_FAIL'));
  }
});

// GET /api/antibiotics/classes -> list of classes with counts
router.get('/classes', auth, requirePermission('studies','read'), async (req,res,next)=>{
  try {
    const has = await ensureAntibioticsTable(req);
    if (!has) return res.json({ classes: [] });
    const ap = activePool(req);
    const { rows } = await ap.query(`
      SELECT COALESCE(class,'(Sin clase)') AS class, COUNT(*)::int AS count
      FROM antibiotics
      GROUP BY COALESCE(class,'(Sin clase)')
      ORDER BY class ASC
    `);
    return res.json({ classes: rows });
  } catch (e) {
    console.error('[ANTIBIOTICS_CLASSES_FAIL]', e);
    return next(new AppError(500,'Error listando clases','ANTIBIOTICS_CLASSES_FAIL'));
  }
});

module.exports = router;
