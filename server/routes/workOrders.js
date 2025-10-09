// Reescritura basada en versión original solicitada con soporte multi-tenant.
const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { requirePermission } = require('../middleware/permissions');
const { validate } = require('../middleware/validate');
const { createWorkOrderSchema, updateWorkOrderSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');

const router = express.Router();
function activePool(req){ return req.tenantPool || pool; }

// Cache de columnas disponibles en work_orders para construir queries robustas
let workOrderColumns = null; // Set<string>
async function ensureWorkOrderColumns(req) {
  if (workOrderColumns) return workOrderColumns;
  try {
    const { rows } = await activePool(req).query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_orders'
    `);
    workOrderColumns = new Set(rows.map(r => r.column_name));
  } catch (e) {
    console.warn('[work_orders] No se pudieron detectar columnas, usando conjunto mínimo por defecto.', e.code || e.message);
    // Fallback ampliado para soportar nuevos campos usados por el frontend
    workOrderColumns = new Set([
      'id','folio','patient_id','referring_entity_id','referring_doctor_id','order_date','status',
      'selected_items','subtotal','descuento','anticipo','total_price','notas','results','validation_notes',
      'results_finalized','receipt_generated','institution_reference','created_at'
    ]);
  }
  return workOrderColumns;
}

// List work orders (basic, limit for now)
// Basic listing (will later add filtering/pagination). Includes recent first.
router.get('/', auth, async (req, res, next) => {
  try {
    const { rows } = await activePool(req).query('SELECT * FROM work_orders ORDER BY order_date DESC, created_at DESC LIMIT 200');
    res.json(rows);
  } catch (e) { console.error(e); next(new AppError(500,'Error listando órdenes','ORDER_LIST_FAIL')); }
});

// Generate next folio: pattern YYYYMMDD-XXX
router.get('/next-folio', auth, requirePermission('work_orders','create'), async (req,res,next)=>{
  try {
    const baseDate = req.query.date ? new Date(req.query.date) : new Date();
    if (isNaN(baseDate.getTime())) return next(new AppError(400,'Fecha inválida','INVALID_DATE'));
    const datePart = `${baseDate.getFullYear()}${String(baseDate.getMonth()+1).padStart(2,'0')}${String(baseDate.getDate()).padStart(2,'0')}`;
    const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS cnt FROM work_orders WHERE folio LIKE $1', [`${datePart}-%`]);
    const consecutive = String(rows[0].cnt + 1).padStart(3,'0');
    res.json({ folio: `${datePart}-${consecutive}` });
  } catch(e){ console.error(e); next(new AppError(500,'Error generando folio','ORDER_FOLIO_FAIL')); }
});

// Count endpoint (all)
router.get('/count', auth, requirePermission('work_orders','read'), async (req,res,next)=>{
  try {
    let base = 'FROM work_orders';
    const params = [];
    if (req.query.since) { base += ' WHERE order_date >= $1'; params.push(req.query.since); }
    const { rows } = await activePool(req).query(`SELECT COUNT(*)::int AS total ${base}`, params);
    res.json({ total: rows[0].total });
  } catch(e){ console.error(e); next(new AppError(500,'Error contando órdenes','ORDER_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('work_orders','read'), async (req,res,next)=>{
  try { const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS total FROM work_orders'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando órdenes','ORDER_COUNT_FAIL')); }
});

// Recent orders (limit param, default 10)
router.get('/recent', auth, requirePermission('work_orders','read'), async (req,res,next)=>{
  const limit = Math.min(parseInt(req.query.limit,10)||10, 50);
  let q = 'SELECT * FROM work_orders';
  const params = [];
  if (req.query.since) { q += ' WHERE order_date >= $1'; params.push(req.query.since); }
  q += ' ORDER BY order_date DESC LIMIT $' + (params.length+1);
  params.push(limit);
  try { const { rows } = await activePool(req).query(q, params); res.json(rows); }
  catch(e){ console.error(e); next(new AppError(500,'Error listando órdenes recientes','ORDER_RECENT_FAIL')); }
});

router.post('/', auth, validate(createWorkOrderSchema), audit('create','work_order', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req, res, next) => {
  const { folio, patient_id, referring_entity_id, referring_doctor_id, institution_reference, status, selected_items, total_price, subtotal, descuento, anticipo, notas, results, validation_notes, order_date } = req.body || {};
  try {
    let cols = await ensureWorkOrderColumns(req);
    // Crear columna institution_reference si el payload la trae y no existe todavía
    if (institution_reference !== undefined && !cols.has('institution_reference')) {
      try {
        await activePool(req).query('ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS institution_reference text');
        workOrderColumns = null; // invalidar cache
        cols = await ensureWorkOrderColumns(req); // refrescar set local
        console.log('[WORK_ORDERS_ADD_COLUMN] institution_reference añadida');
      } catch (e) { console.warn('[WORK_ORDERS_ADD_COLUMN_FAIL] institution_reference', e.code || e.message); }
    }
    // Crear columna results jsonb si llega en el payload y no existe
    if (results !== undefined && !cols.has('results')) {
      try {
        await activePool(req).query('ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS results jsonb');
        workOrderColumns = null;
        cols = await ensureWorkOrderColumns(req);
        console.log('[WORK_ORDERS_ADD_COLUMN] results añadida');
      } catch (e) { console.warn('[WORK_ORDERS_ADD_COLUMN_FAIL] results', e.code || e.message); }
    }
    // Crear columna validation_notes si llega y no existe
    if (validation_notes !== undefined && !cols.has('validation_notes')) {
      try {
        await activePool(req).query('ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS validation_notes text');
        workOrderColumns = null;
        cols = await ensureWorkOrderColumns(req);
        console.log('[WORK_ORDERS_ADD_COLUMN] validation_notes añadida');
      } catch (e) { console.warn('[WORK_ORDERS_ADD_COLUMN_FAIL] validation_notes', e.code || e.message); }
    }
    const jsonbFields = new Set(['selected_items','results']);
    // Campos posibles que podríamos insertar desde el payload
    const possibleFields = {
      folio,
      patient_id,
      referring_entity_id,
  referring_doctor_id,
  institution_reference,
      order_date,
      status,
      selected_items,
      subtotal,
      descuento,
      anticipo,
      total_price,
      notas,
      results,
      validation_notes,
    };
    const names = [];
    const values = [];
    const placeholders = [];
    Object.entries(possibleFields).forEach(([k, v]) => {
      if (cols.has(k)) {
        names.push(k);
        // Serializar JSONB de forma segura y castear placeholder
        if (jsonbFields.has(k)) {
          values.push(v == null ? null : JSON.stringify(v));
          placeholders.push(`$${values.length}::jsonb`);
        } else {
          values.push(v ?? null);
          placeholders.push(`$${values.length}`);
        }
      }
    });
    if (!names.length) return next(new AppError(400,'Payload vacío','ORDER_CREATE_EMPTY'));
    const sql = `INSERT INTO work_orders(${names.join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`;
    const { rows } = await activePool(req).query(sql, values);
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch (e) {
    console.error('[ORDER_CREATE_FAIL]', e);
    // Intento de fallback mínimo si falló por columnas (por ejemplo, migraciones no corridas)
    try {
      const cols = await ensureWorkOrderColumns(req);
      const jsonbFields = new Set(['selected_items','results']);
      const fallbackCandidates = {
        folio,
        patient_id,
        referring_entity_id,
  referring_doctor_id,
  institution_reference,
        order_date,
        status,
        selected_items,
        total_price,
      };
      const names = [];
      const values = [];
      const placeholders = [];
      Object.entries(fallbackCandidates).forEach(([k, v]) => {
        if (cols.has(k)) {
          names.push(k);
          if (jsonbFields.has(k)) {
            values.push(v == null ? null : JSON.stringify(v));
            placeholders.push(`$${values.length}::jsonb`);
          } else {
            values.push(v ?? null);
            placeholders.push(`$${values.length}`);
          }
        }
      });
      if (!names.length) throw new Error('No fallback columns available');
      const sql = `INSERT INTO work_orders(${names.join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`;
      const { rows } = await activePool(req).query(sql, values);
      const created = rows[0];
      res.locals.createdId = created.id;
      return res.status(201).json(created);
    } catch (e2) {
      console.error('[ORDER_CREATE_FALLBACK_FAIL]', e2);
      return next(new AppError(500,'Error creando orden','ORDER_CREATE_FAIL'));
    }
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const { rows } = await activePool(req).query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    if (!rows[0]) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { console.error(e); next(new AppError(500,'Error obteniendo orden','ORDER_GET_FAIL')); }
});

// Para actualizar resultados exigimos 'enter_results'; para solo cambiar status se requiere 'update_status'.
router.put('/:id', auth, (req, res, next) => {
  const wantsResultsChange = Object.prototype.hasOwnProperty.call(req.body || {}, 'results');
  const permMw = require('../middleware/permissions').requirePermission('orders', wantsResultsChange ? 'enter_results' : 'update_status');
  return permMw(req, res, next);
}, validate(updateWorkOrderSchema), audit('update','work_order', req=>req.params.id, (req)=>({ body: req.body })), async (req, res, next) => {
  const attempt = async (retry=false) => {
    let cols = await ensureWorkOrderColumns(req);
    if (retry) console.warn('[WORK_ORDER_UPDATE_RETRY] refreshed columns:', Array.from(cols));
    // Si llega institution_reference y la columna falta, intentar crearla on-demand
    if (Object.prototype.hasOwnProperty.call(req.body,'institution_reference') && !cols.has('institution_reference')) {
      try {
        await activePool(req).query('ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS institution_reference text');
        workOrderColumns = null;
        cols = await ensureWorkOrderColumns(req);
        console.log('[WORK_ORDERS_ADD_COLUMN] institution_reference añadida durante UPDATE');
      } catch(e){ console.warn('[WORK_ORDERS_ADD_COLUMN_FAIL][UPDATE]', e.code || e.message); }
    }
    if (Object.prototype.hasOwnProperty.call(req.body,'results') && !cols.has('results')) {
      try {
        await activePool(req).query('ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS results jsonb');
        workOrderColumns = null;
        cols = await ensureWorkOrderColumns(req);
        console.log('[WORK_ORDERS_ADD_COLUMN] results añadida durante UPDATE');
      } catch(e){ console.warn('[WORK_ORDERS_ADD_COLUMN_FAIL][UPDATE][results]', e.code || e.message); }
    }
    if (Object.prototype.hasOwnProperty.call(req.body,'validation_notes') && !cols.has('validation_notes')) {
      try {
        await activePool(req).query('ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS validation_notes text');
        workOrderColumns = null;
        cols = await ensureWorkOrderColumns(req);
        console.log('[WORK_ORDERS_ADD_COLUMN] validation_notes añadida durante UPDATE');
      } catch(e){ console.warn('[WORK_ORDERS_ADD_COLUMN_FAIL][UPDATE][validation_notes]', e.code || e.message); }
    }
    const fields = ['folio','patient_id','referring_entity_id','referring_doctor_id','institution_reference','order_date','status','selected_items','subtotal','descuento','anticipo','total_price','notas','results','validation_notes','results_finalized','receipt_generated'];
    const updates = [];
    const values = [];
    const jsonbFields = new Set(['selected_items','results']);
    fields.forEach(f => {
      if (!cols.has(f)) return; // saltar campos inexistentes
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        if (jsonbFields.has(f)) {
          updates.push(`${f}=$${values.length + 1}::jsonb`);
          values.push(req.body[f] == null ? null : JSON.stringify(req.body[f]));
        } else {
          updates.push(`${f}=$${values.length + 1}`);
          values.push(req.body[f]);
        }
      }
    });
    if (!cols.has('status') && Object.prototype.hasOwnProperty.call(req.body,'status')) {
      console.warn('[WORK_ORDER_UPDATE_STATUS_SKIPPED_NO_COLUMN]', req.body.status);
    }
    if (updates.length) {
      console.log('[WORK_ORDER_UPDATE_APPLY]', { id: req.params.id, updates: updates.map(u=>u.split('=')[0]), hasStatus: cols.has('status') });
    }
    if (!updates.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
    values.push(req.params.id);
    const { rows } = await activePool(req).query(`UPDATE work_orders SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`, values);
    if (!rows[0]) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    return rows[0];
  };
  try {
    const updated = await attempt(false);
    if (updated) return res.json(updated);
  } catch (e) {
    if (e.code === '42703') { // columna no existe -> refrescar caché y reintentar sin ese campo
      console.warn('[WORK_ORDER_UPDATE_RETRY_COLUMN]', e.column || e.message);
      workOrderColumns = null; // invalidar caché
      try {
        const updated = await attempt(true);
        if (updated) return res.json(updated);
      } catch (e2) {
        console.error('[ORDER_UPDATE_FAIL_RETRY]', e2.code, e2.message);
      }
    } else {
      console.error('[ORDER_UPDATE_FAIL]', e.code, e.message);
    }
    return next(new AppError(500,'Error actualizando orden','ORDER_UPDATE_FAIL'));
  }
});

router.delete('/:id', auth, audit('delete','work_order', req=>req.params.id), async (req, res, next) => {
  try {
    const { rowCount } = await activePool(req).query('DELETE FROM work_orders WHERE id=$1', [req.params.id]);
    if (!rowCount) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    res.status(204).send();
  } catch (e) { console.error(e); next(new AppError(500,'Error eliminando orden','ORDER_DELETE_FAIL')); }
});

// Entrega / envío de reporte: requiere permiso 'send_report'. Cambia status a 'Entregada'.
router.post('/:id/send-report', auth, requirePermission('orders','send_report'), audit('update','work_order', req=>req.params.id, () => ({ action: 'send_report' })), async (req,res,next)=>{
  try {
    const ap = activePool(req);
    const { rows } = await ap.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    const order = rows[0];
    if (!order) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    if (order.status && order.status !== 'Reportada' && order.status !== 'Procesando' && order.status !== 'Pendiente') {
      // Permitir idempotencia si ya está Entregada
      if (order.status === 'Entregada') return res.json(order);
    }
    // Si aún no se han finalizado resultados exigir que existan results
    if (!order.results || Object.keys(order.results || {}).length === 0) {
      return next(new AppError(400,'No hay resultados para enviar','NO_RESULTS_TO_SEND'));
    }
    // Intentar actualizar status y marcar finalized si la columna existe
    let cols = await ensureWorkOrderColumns(req);
  const wantsFinalize = cols.has('results_finalized');
    const updates = ['status=$1'];
    const values = ['Entregada'];
    if (wantsFinalize && order.results_finalized !== true) {
      updates.push(`results_finalized=$${values.length+1}`);
      values.push(true);
    }
    values.push(req.params.id);
  const { rows: upd } = await ap.query(`UPDATE work_orders SET ${updates.join(', ') } WHERE id=$${values.length} RETURNING *`, values);
  return res.json({ ...upd[0], _delivery: { finalized: wantsFinalize, audited: true } });
  } catch(e){
    console.error('[ORDER_SEND_REPORT_FAIL]', e);
    return next(new AppError(500,'Error marcando entrega','ORDER_SEND_REPORT_FAIL'));
  }
});

// VALIDATE (atomic finalize of results) -> sets status Reportada + results_finalized true (if column exists / creates it)
router.post('/:id/validate', auth, requirePermission('orders','enter_results'), audit('update','work_order', req=>req.params.id, () => ({ action: 'validate' })), async (req,res,next) => {
  try {
    let cols = await ensureWorkOrderColumns(req);
    // ensure results_finalized column exists
    if (!cols.has('results_finalized')) {
      try {
        await activePool(req).query('ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS results_finalized boolean DEFAULT false');
        workOrderColumns = null; cols = await ensureWorkOrderColumns(req);
        console.log('[WORK_ORDERS_ADD_COLUMN] results_finalized añadida durante VALIDATE');
      } catch(e){ console.warn('[WORK_ORDERS_ADD_COLUMN_FAIL][VALIDATE][results_finalized]', e.code || e.message); }
    }
    const ap = activePool(req);
    const { rows } = await ap.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    const order = rows[0];
    if (!order) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    if (!order.results || Object.keys(order.results || {}).length === 0) {
      return next(new AppError(400,'No hay resultados para validar','NO_RESULTS_TO_VALIDATE'));
    }
    if (order.status === 'Reportada' && (order.results_finalized === true || !cols.has('results_finalized'))) {
      return res.json(order); // idempotent
    }
    const wantsFinalize = cols.has('results_finalized');
    const updates = ['status=$1'];
    const values = ['Reportada'];
    if (wantsFinalize) { updates.push(`results_finalized=$${values.length+1}`); values.push(true); }
    values.push(req.params.id);
    const { rows: upd } = await ap.query(`UPDATE work_orders SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *` , values);
    return res.json(upd[0]);
  } catch(e){
    console.error('[ORDER_VALIDATE_FAIL]', e.code || e.message, e.detail || '');
    return next(new AppError(500,'Error validando resultados','ORDER_VALIDATE_FAIL'));
  }
});

// REOPEN for correction (only if already validated/delivered) -> status Procesando + results_finalized=false
router.post('/:id/reopen', auth, requirePermission('orders','enter_results'), audit('update','work_order', req=>req.params.id, () => ({ action: 'reopen' })), async (req,res,next) => {
  try {
    let cols = await ensureWorkOrderColumns(req);
    const ap = activePool(req);
    const { rows } = await ap.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    const order = rows[0];
    if (!order) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    if (order.status !== 'Reportada' && order.status !== 'Entregada') {
      return next(new AppError(400,'Sólo órdenes reportadas/entregadas pueden reabrirse','ORDER_REOPEN_INVALID_STATE'));
    }
    const wantsFinalize = cols.has('results_finalized');
    if (wantsFinalize) {
      const { rows: upd } = await ap.query('UPDATE work_orders SET status=$1, results_finalized=false WHERE id=$2 RETURNING *', ['Procesando', req.params.id]);
      return res.json(upd[0]);
    } else {
      const { rows: upd } = await ap.query('UPDATE work_orders SET status=$1 WHERE id=$2 RETURNING *', ['Procesando', req.params.id]);
      return res.json(upd[0]);
    }
  } catch(e){
    console.error('[ORDER_REOPEN_FAIL]', e.code || e.message, e.detail || '');
    return next(new AppError(500,'Error reabriendo orden','ORDER_REOPEN_FAIL'));
  }
});

module.exports = router;
