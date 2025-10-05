const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
const { audit } = require('../middleware/audit');

const router = express.Router();
function activePool(req){ return req.tenantPool || pool; }

// Cache simple de columnas de work_orders para queries financieros.
let financeWorkOrderCols = null; // Set<string>
async function ensureFinanceWorkOrderCols(req, forceRefresh=false){
  if(forceRefresh) financeWorkOrderCols = null;
  if(financeWorkOrderCols) return financeWorkOrderCols;
  try {
    const { rows } = await activePool(req).query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders'`);
    financeWorkOrderCols = new Set(rows.map(r=>r.column_name));
  } catch(e){
    console.warn('[finance] No se pudieron introspectar columnas work_orders', e.code || e.message);
    // Conjunto superset para permitir selects condicionales
  financeWorkOrderCols = new Set(['id','folio','patient_id','referring_entity_id','order_date','created_at','status','total_price','selected_items','anticipo','descuento','subtotal']);
  }
  return financeWorkOrderCols;
}

// Cache de tablas disponibles para soportar diferencias legacy (referring_entities vs referrers)
let financeTables = null; // Set<string>
async function ensureFinanceTables(req, forceRefresh=false){
  if(forceRefresh) financeTables = null;
  if(financeTables) return financeTables;
  try {
    const { rows } = await activePool(req).query(`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`);
    financeTables = new Set(rows.map(r=>r.tablename));
  } catch(e){
    console.warn('[finance] No se pudieron obtener tablas', e.code || e.message);
    financeTables = new Set();
  }
  return financeTables;
}

// Cache columnas de expenses para soportar variaciones (concept vs description, provider, notes)
let expenseCols = null; // Set<string>
async function ensureExpenseCols(req, forceRefresh=false){
  if(forceRefresh) expenseCols = null;
  if(expenseCols) return expenseCols;
  try {
    const { rows } = await activePool(req).query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses'`);
    expenseCols = new Set(rows.map(r=>r.column_name));
  } catch(e){
    console.warn('[finance] No se pudieron introspectar columnas expenses', e.code || e.message);
    expenseCols = new Set(['id','expense_date','concept','category','amount','created_at','description','provider','notes']);
  }
  return expenseCols;
}

// Cache columnas de payments para soportar diferencias (legacy sin work_order_id / notes)
let paymentsCols = null; // Set<string>
async function ensurePaymentsCols(req, forceRefresh=false){
  if(forceRefresh) paymentsCols = null;
  if(paymentsCols) return paymentsCols;
  try {
    const { rows } = await activePool(req).query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='payments'`);
    paymentsCols = new Set(rows.map(r=>r.column_name));
  } catch(e){
    console.warn('[finance] No se pudieron introspectar columnas payments', e.code || e.message);
    paymentsCols = new Set(['id','work_order_id','patient_id','amount','method','payment_date','created_at','notes']);
  }
  return paymentsCols;
}

// List orders with financial summary (balance) and optional filters
router.get('/receivables', auth, requirePermission('finance','read'), async (req,res,next)=>{
  const attempt = async (retry=false)=>{
    const cols = await ensureFinanceWorkOrderCols(req, retry);
    const payCols = await ensurePaymentsCols(req, retry);
    const { from, to, status, entityType, entityId } = req.query;
    const dateCol = cols.has('order_date') ? 'order_date' : (cols.has('created_at') ? 'created_at' : null);
    const where = [];
    const params = [];
    if (from && dateCol) { params.push(from); where.push(`wo.${dateCol} >= $${params.length}`); }
    if (to && dateCol) { params.push(to); where.push(`wo.${dateCol} <= $${params.length}`); }
    if (entityType === 'patient' && entityId && cols.has('patient_id')) { params.push(entityId); where.push(`wo.patient_id = $${params.length}`); }
    if (entityType === 'referrer' && entityId && cols.has('referring_entity_id')) { params.push(entityId); where.push(`wo.referring_entity_id = $${params.length}`); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const totalExpr = cols.has('total_price') ? 'COALESCE(wo.total_price,0)' : '0';
    const orderParts = [];
    if (cols.has('order_date')) orderParts.push('wo.order_date DESC');
    if (cols.has('created_at')) orderParts.push('wo.created_at DESC');
    const orderSql = orderParts.length ? orderParts.join(', ') : '1';
    const joinPayments = payCols.has('work_order_id');
    const anticipoExpr = cols.has('anticipo') ? 'COALESCE(wo.anticipo,0)' : '0::numeric';
    const paidExpr = joinPayments ? `(${anticipoExpr} + COALESCE(SUM(p.amount) FILTER (WHERE p.id IS NOT NULL),0))` : anticipoExpr;
    const balanceExpr = `(${totalExpr} - ${paidExpr})`;
    const q = joinPayments ? `SELECT wo.*, ${paidExpr} AS paid_amount, ${balanceExpr} AS balance
      FROM work_orders wo
      LEFT JOIN payments p ON p.work_order_id = wo.id
      ${whereSql}
      GROUP BY wo.id
      ORDER BY ${orderSql}
      LIMIT 500` : `SELECT wo.*, ${paidExpr} AS paid_amount, ${balanceExpr} AS balance
      FROM work_orders wo
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT 500`;
    const { rows } = await activePool(req).query(q, params);
    let filtered = rows;
    if (status === 'pending') filtered = rows.filter(r=> (parseFloat(r.balance)||0) > 0.009);
    if (status === 'paid') filtered = rows.filter(r=> (parseFloat(r.balance)||0) <= 0.009);
    return filtered;
  };
  try {
    const data = await attempt(false);
    return res.json(data);
  } catch(e){
    if (e.code === '42703' || e.code === '42P01' || /does not exist/i.test(e.message||'')){
      try { const data = await attempt(true); return res.json(data); } catch(e2){ console.error('[RECEIVABLES_FAIL_RETRY]', { code: e2.code, message: e2.message }); return next(new AppError(500,'Error listando cuentas por cobrar','FINANCE_RECEIVABLES_FAIL')); }
    }
    console.error('[RECEIVABLES_FAIL]', { code: e.code, message: e.message });
    return next(new AppError(500,'Error listando cuentas por cobrar','FINANCE_RECEIVABLES_FAIL'));
  }
});

// Create payment
router.post('/payments', auth, requirePermission('finance','create_payment'), audit('create','payment', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{
  const { work_order_id, payment_date, amount, notes } = req.body || {};
  if(!work_order_id || !amount) return next(new AppError(400,'work_order_id y amount requeridos','PAYMENT_REQUIRED_FIELDS'));
  try {
  const { rows } = await activePool(req).query('INSERT INTO payments(work_order_id,payment_date,amount,notes) VALUES($1,$2,$3,$4) RETURNING *',[work_order_id, payment_date || new Date().toISOString(), amount, notes||null]);
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch(e){ console.error(e); next(new AppError(500,'Error registrando pago','PAYMENT_CREATE_FAIL')); }
});

// Expenses CRUD (simple)
router.get('/expenses', auth, requirePermission('finance','read'), async (req,res,next)=>{
  try {
    const cols = await ensureExpenseCols(req);
    const { from, to, category } = req.query;
    const where = [];
    const params = [];
    if (from && cols.has('expense_date')) { params.push(from); where.push(`expense_date >= $${params.length}`); }
    if (to && cols.has('expense_date')) { params.push(to); where.push(`expense_date <= $${params.length}`); }
    if (category && category !== 'all' && cols.has('category')) { params.push(category); where.push(`category = $${params.length}`); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const orderDateCol = cols.has('expense_date') ? 'expense_date' : (cols.has('created_at') ? 'created_at' : '1');
    const { rows } = await activePool(req).query(`SELECT * FROM expenses ${whereSql} ORDER BY ${orderDateCol} DESC LIMIT 1000`, params);
    res.json(rows);
  } catch(e){ console.error('[EXPENSE_LIST_FAIL]', { code: e.code, message: e.message }); next(new AppError(500,'Error listando gastos','EXPENSE_LIST_FAIL')); }
});

router.post('/expenses', auth, requirePermission('finance','create_expense'), audit('create','expense', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{
  const { expense_date, description, concept, category, amount, provider, notes } = req.body || {};
  try {
    const cols = await ensureExpenseCols(req);
    const descValue = description || concept; // aceptar cualquiera
    if(!descValue || !amount || (cols.has('category') && !category)) return next(new AppError(400,'Campos requeridos faltantes','EXPENSE_REQUIRED_FIELDS'));
    // Construir dinámicamente
    const fieldMap = {
      expense_date: expense_date || new Date().toISOString().slice(0,10),
      description: descValue,
      concept: descValue,
      category,
      amount,
      provider: provider || null,
      notes: notes || null
    };
    const names=[]; const placeholders=[]; const values=[];
    Object.entries(fieldMap).forEach(([k,v])=>{
      if(cols.has(k) && v !== undefined){
        names.push(k); values.push(v); placeholders.push(`$${values.length}`);
      }
    });
    if(!names.length) return next(new AppError(400,'Sin columnas válidas para insertar','EXPENSE_NO_COLUMNS'));
    const sql = `INSERT INTO expenses(${names.join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`;
    const { rows } = await activePool(req).query(sql, values);
    res.locals.createdId = rows[0].id; res.status(201).json(rows[0]);
  } catch(e){ console.error('[EXPENSE_CREATE_FAIL]', { code: e.code, message: e.message }); next(new AppError(500,'Error creando gasto','EXPENSE_CREATE_FAIL')); }
});

router.put('/expenses/:id', auth, requirePermission('finance','update_expense'), audit('update','expense', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{
  try {
    const cols = await ensureExpenseCols(req);
    const payload = { ...req.body };
    // Permitir enviar description aunque sólo exista concept o viceversa
    if(payload.description && !payload.concept && cols.has('concept') && !cols.has('description')) payload.concept = payload.description;
    if(payload.concept && !payload.description && cols.has('description') && !cols.has('concept')) payload.description = payload.concept;
    const updatable = ['expense_date','description','concept','category','amount','provider','notes'];
    const sets=[]; const vals=[];
    updatable.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(payload,f) && cols.has(f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(payload[f]); }});
    if(!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
    vals.push(req.params.id);
    const { rows } = await activePool(req).query(`UPDATE expenses SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
    if(!rows[0]) return next(new AppError(404,'Gasto no encontrado','EXPENSE_NOT_FOUND'));
    res.json(rows[0]);
  } catch(e){ console.error('[EXPENSE_UPDATE_FAIL]', { code: e.code, message: e.message }); next(new AppError(500,'Error actualizando gasto','EXPENSE_UPDATE_FAIL')); }
});

router.delete('/expenses/:id', auth, requirePermission('finance','delete_expense'), audit('delete','expense', req=>req.params.id), async (req,res,next)=>{
  try { const { rowCount } = await activePool(req).query('DELETE FROM expenses WHERE id=$1',[req.params.id]); if(!rowCount) return next(new AppError(404,'Gasto no encontrado','EXPENSE_NOT_FOUND')); res.status(204).send(); }
  catch(e){ console.error(e); next(new AppError(500,'Error eliminando gasto','EXPENSE_DELETE_FAIL')); }
});

// Income report endpoint (aggregated)
router.get('/income-report', auth, requirePermission('finance','read'), async (req,res,next)=>{
  const attempt = async (retry=false)=>{
    const { from, to, status } = req.query;
    if (!from || !to) return next(new AppError(400,'from y to requeridos','INCOME_RANGE_REQUIRED'));
    const cols = await ensureFinanceWorkOrderCols(req, retry);
    const tables = await ensureFinanceTables(req, retry);
    const dateColumn = cols.has('order_date') ? 'order_date' : (cols.has('created_at') ? 'created_at' : 'created_at');
    const hasStatus = cols.has('status');
    const selectParts = ['wo.id'];
    if (cols.has('folio')) selectParts.push('wo.folio');
    selectParts.push(`wo.${dateColumn} AS order_date`);
    if (cols.has('total_price')) selectParts.push('wo.total_price');
    if (cols.has('selected_items')) selectParts.push('wo.selected_items');
  if (cols.has('institution_reference')) selectParts.push('wo.institution_reference');
    // Normalizar id de institución / referente (referring_entity_id vs referrer_id)
    if (cols.has('referring_entity_id') || cols.has('referrer_id')) {
      if (cols.has('referring_entity_id') && cols.has('referrer_id')) {
        selectParts.push('COALESCE(wo.referring_entity_id, wo.referrer_id) AS referring_entity_id');
      } else if (cols.has('referring_entity_id')) {
        selectParts.push('wo.referring_entity_id');
      } else {
        selectParts.push('wo.referrer_id AS referring_entity_id');
      }
    }
    if (cols.has('patient_id')) selectParts.push('wo.patient_id');
    // Decidir tabla de referrers
    let refJoin = '';
    if (tables.has('referrers')) {
      if (cols.has('referring_entity_id')) refJoin = 'LEFT JOIN referrers r ON r.id = wo.referring_entity_id';
      else if (cols.has('referrer_id')) refJoin = 'LEFT JOIN referrers r ON r.id = wo.referrer_id';
      else refJoin = '/* referrers table present but no FK column detected */';
    } else if (tables.has('referring_entities')) {
      if (cols.has('referring_entity_id')) refJoin = 'LEFT JOIN referring_entities r ON r.id = wo.referring_entity_id';
      else if (cols.has('referrer_id')) refJoin = 'LEFT JOIN referring_entities r ON r.id = wo.referrer_id';
      else refJoin = '/* referring_entities table present but no FK column detected */';
  } else refJoin = '/* no referrers table present */';
    const validStatuses = (status ? status.split(',') : ['Reportada','Concluida']).filter(Boolean);
    const params=[from,to];
    let where = `wo.${dateColumn} BETWEEN $1 AND $2`;
    if (hasStatus && validStatuses.length){
      params.push(validStatuses);
      where += ` AND wo.status = ANY($${params.length}::text[])`;
    }
    const hasRefTable = /JOIN\s+(referrers|referring_entities)\s+r/i.test(refJoin);
    const finalSelect = [ ...selectParts, 'p.full_name AS patient_name', hasRefTable ? 'r.name AS referrer_name' : 'NULL::text AS referrer_name' ].join(', ');
    const q = `SELECT ${finalSelect}
      FROM work_orders wo
      LEFT JOIN patients p ON p.id = wo.patient_id
      ${refJoin}
      WHERE ${where}`;
    const { rows } = await activePool(req).query(q, params);
    // Si no se pudo filtrar por status en SQL (columna faltante) filtrar en memoria si existe en rows
    if(!hasStatus && validStatuses.length){
      return rows.filter(r=> validStatuses.includes(r.status));
    }
    return rows;
  };
  try {
    const rows = await attempt(false);
    return res.json(rows);
  } catch(e){
    if(e.code === '42703' || e.code === '42P01' || /does not exist/i.test(e.message||'')){
      try {
        const rows = await attempt(true);
        return res.json(rows);
      } catch(e2){ console.error('[INCOME_REPORT_FAIL_RETRY]', { code: e2.code, message: e2.message }); return next(new AppError(500,'Error generando income report','INCOME_REPORT_FAIL')); }
    }
    console.error('[INCOME_REPORT_FAIL]', { code: e.code, message: e.message }); return next(new AppError(500,'Error generando income report','INCOME_REPORT_FAIL'));
  }
});

module.exports = router;