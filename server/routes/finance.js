const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
const { audit } = require('../middleware/audit');

const router = express.Router();

// List orders with financial summary (balance) and optional filters
router.get('/receivables', auth, requirePermission('finance','read'), async (req,res,next)=>{
  try {
    const { from, to, status, entityType, entityId } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`wo.order_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`wo.order_date <= $${params.length}`); }
    if (entityType === 'patient' && entityId) { params.push(entityId); where.push(`wo.patient_id = $${params.length}`); }
    if (entityType === 'referrer' && entityId) { params.push(entityId); where.push(`wo.referring_entity_id = $${params.length}`); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const q = `
      SELECT wo.*, 
        COALESCE(SUM(p.amount) FILTER (WHERE p.id IS NOT NULL),0) AS paid_amount,
        (COALESCE(wo.total_price,0) - COALESCE(SUM(p.amount) FILTER (WHERE p.id IS NOT NULL),0)) AS balance
      FROM work_orders wo
      LEFT JOIN payments p ON p.work_order_id = wo.id
      ${whereSql}
      GROUP BY wo.id
      ORDER BY wo.order_date DESC, wo.created_at DESC
      LIMIT 500
    `;
    const { rows } = await pool.query(q, params);
    let filtered = rows;
    if (status === 'pending') filtered = rows.filter(r=> (parseFloat(r.balance)||0) > 0.009);
    if (status === 'paid') filtered = rows.filter(r=> (parseFloat(r.balance)||0) <= 0.009);
    res.json(filtered);
  } catch(e){ console.error(e); next(new AppError(500,'Error listando cuentas por cobrar','FINANCE_RECEIVABLES_FAIL')); }
});

// Create payment
router.post('/payments', auth, requirePermission('finance','create_payment'), audit('create','payment', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{
  const { work_order_id, payment_date, amount, notes } = req.body || {};
  if(!work_order_id || !amount) return next(new AppError(400,'work_order_id y amount requeridos','PAYMENT_REQUIRED_FIELDS'));
  try {
    const { rows } = await pool.query('INSERT INTO payments(work_order_id,payment_date,amount,notes) VALUES($1,$2,$3,$4) RETURNING *',[work_order_id, payment_date || new Date().toISOString(), amount, notes||null]);
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch(e){ console.error(e); next(new AppError(500,'Error registrando pago','PAYMENT_CREATE_FAIL')); }
});

// Expenses CRUD (simple)
router.get('/expenses', auth, requirePermission('finance','read'), async (req,res,next)=>{
  try {
    const { from, to, category } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`expense_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`expense_date <= $${params.length}`); }
    if (category && category !== 'all') { params.push(category); where.push(`category = $${params.length}`); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await pool.query(`SELECT * FROM expenses ${whereSql} ORDER BY expense_date DESC, created_at DESC LIMIT 1000`, params);
    res.json(rows);
  } catch(e){ console.error(e); next(new AppError(500,'Error listando gastos','EXPENSE_LIST_FAIL')); }
});

router.post('/expenses', auth, requirePermission('finance','create_expense'), audit('create','expense', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{
  const { expense_date, description, category, amount, provider, notes } = req.body || {};
  if(!description || !category || !amount) return next(new AppError(400,'Campos requeridos faltantes','EXPENSE_REQUIRED_FIELDS'));
  try {
    const { rows } = await pool.query('INSERT INTO expenses(expense_date,description,category,amount,provider,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[expense_date||new Date().toISOString().slice(0,10), description, category, amount, provider||null, notes||null]);
    res.locals.createdId = rows[0].id; res.status(201).json(rows[0]);
  } catch(e){ console.error(e); next(new AppError(500,'Error creando gasto','EXPENSE_CREATE_FAIL')); }
});

router.put('/expenses/:id', auth, requirePermission('finance','update_expense'), audit('update','expense', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{
  const fields=['expense_date','description','category','amount','provider','notes'];
  const sets=[]; const vals=[];
  fields.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); }});
  if(!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
  vals.push(req.params.id);
  try { const { rows } = await pool.query(`UPDATE expenses SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals); if(!rows[0]) return next(new AppError(404,'Gasto no encontrado','EXPENSE_NOT_FOUND')); res.json(rows[0]); }
  catch(e){ console.error(e); next(new AppError(500,'Error actualizando gasto','EXPENSE_UPDATE_FAIL')); }
});

router.delete('/expenses/:id', auth, requirePermission('finance','delete_expense'), audit('delete','expense', req=>req.params.id), async (req,res,next)=>{
  try { const { rowCount } = await pool.query('DELETE FROM expenses WHERE id=$1',[req.params.id]); if(!rowCount) return next(new AppError(404,'Gasto no encontrado','EXPENSE_NOT_FOUND')); res.status(204).send(); }
  catch(e){ console.error(e); next(new AppError(500,'Error eliminando gasto','EXPENSE_DELETE_FAIL')); }
});

// Income report endpoint (aggregated)
router.get('/income-report', auth, requirePermission('finance','read'), async (req,res,next)=>{
  try {
    const { from, to, status } = req.query;
    if (!from || !to) return next(new AppError(400,'from y to requeridos','INCOME_RANGE_REQUIRED'));
    const validStatuses = (status ? status.split(',') : ['Reportada','Concluida']).filter(Boolean);
    const params=[from,to];
    const statusList = validStatuses.map((s,i)=>`$${params.push(s)}`).join(',');
    const q = `SELECT wo.id, wo.folio, wo.order_date, wo.total_price, wo.selected_items, wo.referring_entity_id, wo.patient_id,
      p.full_name AS patient_name, r.name AS referrer_name
      FROM work_orders wo
      LEFT JOIN patients p ON p.id = wo.patient_id
      LEFT JOIN referring_entities r ON r.id = wo.referring_entity_id
      WHERE wo.order_date BETWEEN $1 AND $2 AND wo.status = ANY(ARRAY[${statusList}])`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch(e){ console.error(e); next(new AppError(500,'Error generando income report','INCOME_REPORT_FAIL')); }
});

module.exports = router;