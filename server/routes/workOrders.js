const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
const { validate } = require('../middleware/validate');
const { createWorkOrderSchema, updateWorkOrderSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');

// Cache de columnas disponibles en work_orders para construir queries robustas
let workOrderColumns = null; // Set<string>
async function ensureWorkOrderColumns() {
  if (workOrderColumns) return workOrderColumns;
  try {
    const { rows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_orders'
    `);
    workOrderColumns = new Set(rows.map(r => r.column_name));
  } catch (e) {
    console.warn('[work_orders] No se pudieron detectar columnas, usando conjunto mínimo por defecto.', e.code || e.message);
    workOrderColumns = new Set(['id','folio','patient_id','referring_entity_id','referring_doctor_id','order_date','status','selected_items','total_price','results_finalized','receipt_generated','created_at']);
  }
  return workOrderColumns;
}

// List work orders (basic, limit for now)
// Basic listing (will later add filtering/pagination). Includes recent first.
router.get('/', auth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM work_orders ORDER BY order_date DESC, created_at DESC LIMIT 200');
    res.json(rows);
  } catch (e) { console.error(e); next(new AppError(500,'Error listando órdenes','ORDER_LIST_FAIL')); }
});

// Generate next folio: pattern YYYYMMDD-XXX
router.get('/next-folio', auth, requirePermission('work_orders','create'), async (req,res,next)=>{
  try {
    const baseDate = req.query.date ? new Date(req.query.date) : new Date();
    if (isNaN(baseDate.getTime())) return next(new AppError(400,'Fecha inválida','INVALID_DATE'));
    const datePart = `${baseDate.getFullYear()}${String(baseDate.getMonth()+1).padStart(2,'0')}${String(baseDate.getDate()).padStart(2,'0')}`;
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM work_orders WHERE folio LIKE $1', [`${datePart}-%`]);
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
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS total ${base}`, params);
    res.json({ total: rows[0].total });
  } catch(e){ console.error(e); next(new AppError(500,'Error contando órdenes','ORDER_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('work_orders','read'), async (_req,res,next)=>{
  try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM work_orders'); res.json({ total: rows[0].total }); }
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
  try { const { rows } = await pool.query(q, params); res.json(rows); }
  catch(e){ console.error(e); next(new AppError(500,'Error listando órdenes recientes','ORDER_RECENT_FAIL')); }
});

router.post('/', auth, validate(createWorkOrderSchema), audit('create','work_order', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req, res, next) => {
  const { folio, patient_id, referring_entity_id, referring_doctor_id, status, selected_items, total_price, subtotal, descuento, anticipo, notas, results, validation_notes, order_date } = req.body || {};
  try {
    const cols = await ensureWorkOrderColumns();
    const jsonbFields = new Set(['selected_items','results']);
    // Campos posibles que podríamos insertar desde el payload
    const possibleFields = {
      folio,
      patient_id,
      referring_entity_id,
      referring_doctor_id,
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
    const { rows } = await pool.query(sql, values);
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch (e) {
    console.error('[ORDER_CREATE_FAIL]', e);
    // Intento de fallback mínimo si falló por columnas (por ejemplo, migraciones no corridas)
    try {
      const cols = await ensureWorkOrderColumns();
      const jsonbFields = new Set(['selected_items','results']);
      const fallbackCandidates = {
        folio,
        patient_id,
        referring_entity_id,
        referring_doctor_id,
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
      const { rows } = await pool.query(sql, values);
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
    const { rows } = await pool.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
  if (!rows[0]) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { console.error(e); next(new AppError(500,'Error obteniendo orden','ORDER_GET_FAIL')); }
});

router.put('/:id', auth, validate(updateWorkOrderSchema), audit('update','work_order', req=>req.params.id, (req)=>({ body: req.body })), async (req, res, next) => {
  const fields = ['folio','patient_id','referring_entity_id','referring_doctor_id','order_date','status','selected_items','subtotal','descuento','anticipo','total_price','notas','results','validation_notes','results_finalized','receipt_generated'];
  const updates = [];
  const values = [];
  const jsonbFields = new Set(['selected_items','results']);
  fields.forEach(f => {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      // Agregar placeholder con casteo cuando sea JSONB
      if (jsonbFields.has(f)) {
        updates.push(`${f}=$${values.length + 1}::jsonb`);
        values.push(req.body[f] == null ? null : JSON.stringify(req.body[f]));
      } else {
        updates.push(`${f}=$${values.length + 1}`);
        values.push(req.body[f]);
      }
    }
  });
  if (!updates.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE work_orders SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`, values);
    if (!rows[0]) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { console.error(e); next(new AppError(500,'Error actualizando orden','ORDER_UPDATE_FAIL')); }
});

router.delete('/:id', auth, audit('delete','work_order', req=>req.params.id), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM work_orders WHERE id=$1', [req.params.id]);
    if (!rowCount) return next(new AppError(404,'Orden no encontrada','ORDER_NOT_FOUND'));
    res.status(204).send();
  } catch (e) { console.error(e); next(new AppError(500,'Error eliminando orden','ORDER_DELETE_FAIL')); }
});

module.exports = router;
