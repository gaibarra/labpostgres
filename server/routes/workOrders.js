// Reescritura basada en versión original solicitada con soporte multi-tenant.
const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { requirePermission } = require('../middleware/permissions');
const { validate } = require('../middleware/validate');
const { createWorkOrderSchema, updateWorkOrderSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');
const { sendReportEmail } = require('../services/emailReportSender');

const router = express.Router();
function activePool(req) { return req.tenantPool || pool; }

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
    // Fallback mínimo para no romper listados aunque la introspección falle (p.ej., falta de permisos).
    workOrderColumns = new Set([
      'id', 'folio', 'patient_id', 'referring_entity_id', 'referring_doctor_id', 'order_date', 'status',
      'selected_items', 'subtotal', 'descuento', 'anticipo', 'total_price', 'notas', 'created_at',
      'report_extra_description', 'report_extra_diagnosis', 'report_extra_notes'
    ]);
  }
  return workOrderColumns;
}

function assertSchemaColumns(cols, payload, ctx = 'work_orders') {
  const critical = ['institution_reference', 'results', 'validation_notes', 'report_extra_description', 'report_extra_diagnosis', 'report_extra_notes'];
  const missing = critical.filter((field) => Object.prototype.hasOwnProperty.call(payload || {}, field) && !cols.has(field));
  if (missing.length) {
    throw new AppError(400,
      `Campos faltantes en ${ctx}: ${missing.join(', ')}. Ejecuta las migraciones pendientes.`,
      'WORK_ORDER_SCHEMA_OUT_OF_SYNC'
    );
  }
}

function invalidateWorkOrderColumns() {
  workOrderColumns = null;
}

// List work orders with pagination + search (patient-aware)
router.get('/', auth, async (req, res, next) => {
  const parsePositiveInt = (val, fallback) => {
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const maxPageSize = 1000;
  const defaultPageSize = 50;
  const page = Math.max(parsePositiveInt(req.query.page, 1), 1);
  const rawSize = parsePositiveInt(req.query.pageSize, defaultPageSize);
  const pageSize = Math.min(Math.max(rawSize, 1), maxPageSize);
  const offset = (page - 1) * pageSize;
  const searchTerm = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const params = [];
  const filters = [];

  if (searchTerm) {
    const collapsed = searchTerm.replace(/\s+/g, ' ').trim();
    const normalizedLower = `%${collapsed.toLowerCase()}%`;
    params.push(normalizedLower);
    const lowerIdx = params.length;
    const rawPattern = `%${collapsed}%`;
    params.push(rawPattern);
    const rawIdx = params.length;
    const searchClauses = [
      `LOWER(COALESCE(wo.folio,'')) LIKE $${lowerIdx}`,
      `LOWER(COALESCE(wo.status,'')) LIKE $${lowerIdx}`,
      `LOWER(COALESCE(wo.institution_reference,'')) LIKE $${lowerIdx}`,
      `LOWER(COALESCE(patient.patient_json->>'full_name','')) LIKE $${lowerIdx}`,
      `LOWER(CONCAT_WS(' ', NULLIF(patient.patient_json->>'first_name',''), NULLIF(patient.patient_json->>'last_name',''))) LIKE $${lowerIdx}`,
      `LOWER(COALESCE(patient.patient_json->>'external_id','')) LIKE $${lowerIdx}`,
      `LOWER(COALESCE(patient.patient_json->>'document_number','')) LIKE $${lowerIdx}`,
      `COALESCE(patient.patient_json->>'phone','') ILIKE $${rawIdx}`,
      `COALESCE(patient.patient_json->>'phone_number','') ILIKE $${rawIdx}`
    ];
    const digitsOnly = collapsed.replace(/\D+/g, '');
    if (digitsOnly) {
      params.push(`%${digitsOnly}%`);
      const digitsIdx = params.length;
      searchClauses.push(`REGEXP_REPLACE(COALESCE(patient.patient_json->>'phone',''),'\\D','','g') LIKE $${digitsIdx}`);
      searchClauses.push(`REGEXP_REPLACE(COALESCE(patient.patient_json->>'phone_number',''),'\\D','','g') LIKE $${digitsIdx}`);
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(collapsed)) {
      params.push(collapsed);
      const uuidIdx = params.length;
      searchClauses.push(`wo.id::text = $${uuidIdx}`);
      searchClauses.push(`wo.patient_id::text = $${uuidIdx}`);
    }
    if (/^\d+$/.test(collapsed)) {
      params.push(collapsed);
      const numIdx = params.length;
      searchClauses.push(`wo.order_number::text = $${numIdx}`);
    }
    filters.push(`(${searchClauses.join(' OR ')})`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const fromClause = `
    FROM work_orders wo
    LEFT JOIN LATERAL (
      SELECT to_jsonb(p.*) AS patient_json
      FROM patients p
      WHERE p.id = wo.patient_id
    ) patient ON true
  `;
  try {
    const ap = activePool(req);
    const countSql = `SELECT COUNT(*)::int AS total ${fromClause} ${whereClause}`;
    const { rows: countRows } = await ap.query(countSql, params);
    const total = countRows[0]?.total || 0;
    const orderSql = `
      SELECT wo.*,
             patient.patient_json AS patient_snapshot,
             COALESCE(
               NULLIF(patient.patient_json->>'full_name',''),
               NULLIF(CONCAT_WS(' ', NULLIF(patient.patient_json->>'first_name',''), NULLIF(patient.patient_json->>'last_name','')), ''),
               NULLIF(patient.patient_json->>'external_id',''),
               NULLIF(patient.patient_json->>'document_number','')
             ) AS patient_name
      ${fromClause}
      ${whereClause}
      ORDER BY wo.order_date DESC NULLS LAST, wo.created_at DESC NULLS LAST
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    const { rows } = await ap.query(orderSql, [...params, pageSize, offset]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    res.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page * pageSize < total,
        search: searchTerm || null
      }
    });
  } catch (e) {
    console.error('[ORDER_LIST_FAIL]', e);
    next(new AppError(500, 'Error listando órdenes', 'ORDER_LIST_FAIL'));
  }
});

// Generate next folio: pattern YYYYMMDD-XXX
router.get('/next-folio', auth, requirePermission('work_orders', 'create'), async (req, res, next) => {
  try {
    const baseDate = req.query.date ? new Date(req.query.date) : new Date();
    if (isNaN(baseDate.getTime())) return next(new AppError(400, 'Fecha inválida', 'INVALID_DATE'));
    const datePart = `${baseDate.getFullYear()}${String(baseDate.getMonth() + 1).padStart(2, '0')}${String(baseDate.getDate()).padStart(2, '0')}`;
    const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS cnt FROM work_orders WHERE folio LIKE $1', [`${datePart}-%`]);
    const consecutive = String(rows[0].cnt + 1).padStart(3, '0');
    res.json({ folio: `${datePart}-${consecutive}` });
  } catch (e) { console.error(e); next(new AppError(500, 'Error generando folio', 'ORDER_FOLIO_FAIL')); }
});

// Count endpoint (all)
router.get('/count', auth, requirePermission('work_orders', 'read'), async (req, res, next) => {
  try {
    let base = 'FROM work_orders';
    const params = [];
    if (req.query.since) { base += ' WHERE order_date >= $1'; params.push(req.query.since); }
    const { rows } = await activePool(req).query(`SELECT COUNT(*)::int AS total ${base}`, params);
    res.json({ total: rows[0].total });
  } catch (e) { console.error(e); next(new AppError(500, 'Error contando órdenes', 'ORDER_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('work_orders', 'read'), async (req, res, next) => {
  try { const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS total FROM work_orders'); res.json({ total: rows[0].total }); }
  catch (e) { console.error(e); next(new AppError(500, 'Error contando órdenes', 'ORDER_COUNT_FAIL')); }
});

// Dashboard Stats - KPIs de valor agregado
router.get('/stats', auth, requirePermission('work_orders', 'read'), async (req, res, next) => {
  try {
    const ap = activePool(req);
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Ejecutar queries en paralelo
    const [
      ordersToday,
      ordersWeek,
      ordersMonth,
      statusCounts,
      revenueToday,
      revenueWeek,
      avgDeliveryTime,
      topStudies
    ] = await Promise.all([
      // Órdenes de hoy
      ap.query(`SELECT COUNT(*)::int AS count FROM work_orders WHERE order_date >= $1`, [today]),
      // Órdenes última semana
      ap.query(`SELECT COUNT(*)::int AS count FROM work_orders WHERE order_date >= $1`, [weekAgo]),
      // Órdenes último mes
      ap.query(`SELECT COUNT(*)::int AS count FROM work_orders WHERE order_date >= $1`, [monthAgo]),
      // Conteo por estado
      ap.query(`
        SELECT status, COUNT(*)::int AS count 
        FROM work_orders 
        WHERE order_date >= $1
        GROUP BY status
      `, [monthAgo]),
      // Ingresos de hoy
      ap.query(`SELECT COALESCE(SUM(total_price), 0)::numeric AS total FROM work_orders WHERE order_date >= $1`, [today]),
      // Ingresos última semana
      ap.query(`SELECT COALESCE(SUM(total_price), 0)::numeric AS total FROM work_orders WHERE order_date >= $1`, [weekAgo]),
      // Tiempo promedio de entrega (de Pendiente a Entregada) en horas
      ap.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)::numeric AS avg_hours
        FROM work_orders 
        WHERE status = 'Entregada' 
        AND updated_at IS NOT NULL 
        AND order_date >= $1
      `, [monthAgo]).catch(() => ({ rows: [{ avg_hours: null }] })),
      // Top 5 estudios más solicitados (del último mes)
      ap.query(`
        SELECT 
          item->>'name' AS study_name,
          COUNT(*)::int AS count
        FROM work_orders,
        jsonb_array_elements(selected_items) AS item
        WHERE order_date >= $1
        GROUP BY item->>'name'
        ORDER BY count DESC
        LIMIT 5
      `, [monthAgo]).catch(() => ({ rows: [] }))
    ]);

    // Calcular tasa de conversión
    const statusMap = {};
    (statusCounts.rows || []).forEach(r => { statusMap[r.status] = r.count; });
    const completed = (statusMap['Reportada'] || 0) + (statusMap['Entregada'] || 0);
    const total = ordersMonth.rows[0]?.count || 0;
    const conversionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    res.json({
      ordersToday: ordersToday.rows[0]?.count || 0,
      ordersWeek: ordersWeek.rows[0]?.count || 0,
      ordersMonth: ordersMonth.rows[0]?.count || 0,
      revenueToday: parseFloat(revenueToday.rows[0]?.total || 0),
      revenueWeek: parseFloat(revenueWeek.rows[0]?.total || 0),
      avgDeliveryTimeHours: avgDeliveryTime.rows[0]?.avg_hours
        ? parseFloat(avgDeliveryTime.rows[0].avg_hours).toFixed(1)
        : null,
      conversionRate: parseFloat(conversionRate),
      topStudies: topStudies.rows || [],
      statusBreakdown: statusMap
    });
  } catch (e) {
    console.error('[ORDER_STATS_FAIL]', e);
    next(new AppError(500, 'Error obteniendo estadísticas', 'ORDER_STATS_FAIL'));
  }
});

// Status summary para gráfico de dona
router.get('/status-summary', auth, requirePermission('work_orders', 'read'), async (req, res, next) => {
  try {
    const ap = activePool(req);
    const daysBack = parseInt(req.query.days, 10) || 30;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { rows } = await ap.query(`
      SELECT 
        COALESCE(status, 'Sin estado') AS status, 
        COUNT(*)::int AS count
      FROM work_orders 
      WHERE order_date >= $1
      GROUP BY status
      ORDER BY count DESC
    `, [since]);

    // Mapear a colores para el chart
    const colorMap = {
      'Pendiente': '#FBBF24',
      'Procesando': '#F97316',
      'Concluida': '#3B82F6',
      'Reportada': '#22C55E',
      'Entregada': '#10B981',
      'Cancelada': '#EF4444',
      'Sin estado': '#9CA3AF'
    };

    res.json({
      data: rows.map(r => ({
        name: r.status,
        value: r.count,
        color: colorMap[r.status] || '#6B7280'
      })),
      total: rows.reduce((acc, r) => acc + r.count, 0),
      period: `${daysBack} días`
    });
  } catch (e) {
    console.error('[ORDER_STATUS_SUMMARY_FAIL]', e);
    next(new AppError(500, 'Error obteniendo resumen de estados', 'ORDER_STATUS_SUMMARY_FAIL'));
  }
});

// Recent orders (limit param, default 10)
router.get('/recent', auth, requirePermission('work_orders', 'read'), async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  let q = 'SELECT * FROM work_orders';
  const params = [];
  if (req.query.since) { q += ' WHERE order_date >= $1'; params.push(req.query.since); }
  q += ' ORDER BY order_date DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  try { const { rows } = await activePool(req).query(q, params); res.json(rows); }
  catch (e) { console.error(e); next(new AppError(500, 'Error listando órdenes recientes', 'ORDER_RECENT_FAIL')); }
});

router.post('/', auth, validate(createWorkOrderSchema), audit('create', 'work_order', (req, r) => r.locals?.createdId, (req) => ({ body: req.body })), async (req, res, next) => {
  const { folio, patient_id, referring_entity_id, referring_doctor_id, institution_reference, status, selected_items, total_price, subtotal, descuento, anticipo, notas, results, validation_notes, order_date, report_extra_description, report_extra_diagnosis, report_extra_notes } = req.body || {};
  try {
    const cols = await ensureWorkOrderColumns(req);
    assertSchemaColumns(cols, req.body);
    const jsonbFields = new Set(['selected_items', 'results']);
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
      report_extra_description,
      report_extra_diagnosis,
      report_extra_notes,
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
    if (!names.length) return next(new AppError(400, 'Payload vacío', 'ORDER_CREATE_EMPTY'));
    const sql = `INSERT INTO work_orders(${names.join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`;
    const { rows } = await activePool(req).query(sql, values);
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch (e) {
    invalidateWorkOrderColumns();
    console.error('[ORDER_CREATE_FAIL]', e);
    return next(new AppError(500, 'Error creando orden', 'ORDER_CREATE_FAIL'));
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const { rows } = await activePool(req).query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    if (!rows[0]) return next(new AppError(404, 'Orden no encontrada', 'ORDER_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { console.error(e); next(new AppError(500, 'Error obteniendo orden', 'ORDER_GET_FAIL')); }
});

// Para actualizar resultados exigimos 'enter_results'; para solo cambiar status se requiere 'update_status'.
router.put('/:id', auth, (req, res, next) => {
  const wantsResultsChange = Object.prototype.hasOwnProperty.call(req.body || {}, 'results');
  const permMw = require('../middleware/permissions').requirePermission('orders', wantsResultsChange ? 'enter_results' : 'update_status');
  return permMw(req, res, next);
}, validate(updateWorkOrderSchema), audit('update', 'work_order', req => req.params.id, (req) => ({ body: req.body })), async (req, res, next) => {
  const attempt = async (retry = false) => {
    const cols = await ensureWorkOrderColumns(req);
    if (retry) console.warn('[WORK_ORDER_UPDATE_RETRY] refreshed columns:', Array.from(cols));
    assertSchemaColumns(cols, req.body);
    const fields = ['folio', 'patient_id', 'referring_entity_id', 'referring_doctor_id', 'institution_reference', 'order_date', 'status', 'selected_items', 'subtotal', 'descuento', 'anticipo', 'total_price', 'notas', 'results', 'validation_notes', 'results_finalized', 'receipt_generated', 'report_extra_description', 'report_extra_diagnosis', 'report_extra_notes'];
    const updates = [];
    const values = [];
    const jsonbFields = new Set(['selected_items', 'results']);
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
    if (!cols.has('status') && Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      console.warn('[WORK_ORDER_UPDATE_STATUS_SKIPPED_NO_COLUMN]', req.body.status);
    }
    if (updates.length) {
      console.log('[WORK_ORDER_UPDATE_APPLY]', { id: req.params.id, updates: updates.map(u => u.split('=')[0]), hasStatus: cols.has('status') });
    }
    if (!updates.length) return next(new AppError(400, 'Nada para actualizar', 'NO_UPDATE_FIELDS'));
    values.push(req.params.id);
    const { rows } = await activePool(req).query(`UPDATE work_orders SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`, values);
    if (!rows[0]) return next(new AppError(404, 'Orden no encontrada', 'ORDER_NOT_FOUND'));
    return rows[0];
  };
  try {
    const updated = await attempt(false);
    if (updated) return res.json(updated);
  } catch (e) {
    if (e.code === '42703') {
      console.warn('[WORK_ORDER_UPDATE_RETRY_COLUMN]', e.column || e.message);
      invalidateWorkOrderColumns();
      try {
        const updated = await attempt(true);
        if (updated) return res.json(updated);
      } catch (e2) {
        console.error('[ORDER_UPDATE_FAIL_RETRY]', e2.code, e2.message);
      }
    } else {
      console.error('[ORDER_UPDATE_FAIL]', e.code, e.message);
    }
    return next(new AppError(500, 'Error actualizando orden', 'ORDER_UPDATE_FAIL'));
  }
});

router.delete('/:id', auth, audit('delete', 'work_order', req => req.params.id), async (req, res, next) => {
  try {
    const { rowCount } = await activePool(req).query('DELETE FROM work_orders WHERE id=$1', [req.params.id]);
    if (!rowCount) return next(new AppError(404, 'Orden no encontrada', 'ORDER_NOT_FOUND'));
    res.status(204).send();
  } catch (e) { console.error(e); next(new AppError(500, 'Error eliminando orden', 'ORDER_DELETE_FAIL')); }
});

// Entrega / envío de reporte: requiere permiso 'send_report'. Cambia status a 'Entregada'.
router.post('/:id/send-report', auth, requirePermission('orders', 'send_report'), audit('update', 'work_order', req => req.params.id, () => ({ action: 'send_report' })), async (req, res, next) => {
  try {
    const ap = activePool(req);
    const { rows } = await ap.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    const order = rows[0];
    if (!order) return next(new AppError(404, 'Orden no encontrada', 'ORDER_NOT_FOUND'));
    if (order.status && order.status !== 'Reportada' && order.status !== 'Procesando' && order.status !== 'Pendiente') {
      // Permitir idempotencia si ya está Entregada
      if (order.status === 'Entregada') return res.json(order);
    }
    // Si aún no se han finalizado resultados exigir que existan results
    if (!order.results || Object.keys(order.results || {}).length === 0) {
      return next(new AppError(400, 'No hay resultados para enviar', 'NO_RESULTS_TO_SEND'));
    }
    // Intentar actualizar status y marcar finalized si la columna existe
    let cols = await ensureWorkOrderColumns(req);
    const wantsFinalize = cols.has('results_finalized');
    const updates = ['status=$1'];
    const values = ['Entregada'];
    if (wantsFinalize && order.results_finalized !== true) {
      updates.push(`results_finalized=$${values.length + 1}`);
      values.push(true);
    }
    values.push(req.params.id);
    const { rows: upd } = await ap.query(`UPDATE work_orders SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`, values);
    return res.json({ ...upd[0], _delivery: { finalized: wantsFinalize, audited: true } });
  } catch (e) {
    console.error('[ORDER_SEND_REPORT_FAIL]', e);
    return next(new AppError(500, 'Error marcando entrega', 'ORDER_SEND_REPORT_FAIL'));
  }
});

// API: generate-and-send report (server-side orchestrator)
// Body: { channel: 'email'|'whatsapp'|'telegram', emailTo?, phone?, telegramChatId? }
router.post('/:id/send-report/dispatch', auth, requirePermission('orders', 'send_report'), async (req, res, next) => {
  try {
    const ap = activePool(req);
    const { rows } = await ap.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    const order = rows[0];
    if (!order) return next(new AppError(404, 'Orden no encontrada', 'ORDER_NOT_FOUND'));
    if (!order.results || Object.keys(order.results || {}).length === 0) {
      return next(new AppError(400, 'No hay resultados para enviar', 'NO_RESULTS_TO_SEND'));
    }
    // Compose a lightweight summary and a link to download PDF from client
    const channel = String(req.body?.channel || '').toLowerCase();
    const patient = req.body?.patient || {}; // client can pass patient meta (name/email/phone)
    const labName = (req.body?.labName) || 'Laboratorio Clínico';
    const summary = `Resultados de Laboratorio - ${labName} | Folio ${order.folio} | Paciente: ${patient.full_name || ''}`;

    // NOTE: In this repo we do not have mail/whatsapp/telegram providers wired.
    // Respond with instructions and mark as attempted.
    // Later this endpoint can integrate with Nodemailer, Twilio WhatsApp API, Telegram Bot API, etc.
    const response = { ok: true, channel, summary, instruction: 'Adjunte el PDF generado por el cliente y envíe mediante su proveedor.' };
    return res.json(response);
  } catch (e) {
    console.error('[SEND_REPORT_DISPATCH_FAIL]', e);
    return next(new AppError(500, 'No se pudo preparar el envío', 'SEND_REPORT_DISPATCH_FAIL'));
  }
});

// Automatic email sending with PDF attachment
// Body: { to: 'correo@destino', smtp: { host, port, secure, user, pass } }
router.post('/:id/send-report/email', auth, requirePermission('orders', 'send_report'), async (req, res, next) => {
  try {
    const ap = activePool(req);
    const { rows } = await ap.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    const order = rows[0];
    if (!order) return next(new AppError(404, 'Orden no encontrada', 'ORDER_NOT_FOUND'));
    if (!order.results || Object.keys(order.results || {}).length === 0) {
      return next(new AppError(400, 'No hay resultados para enviar', 'NO_RESULTS_TO_SEND'));
    }
    const { to: toRaw, smtp: smtpIn, patient: patientIn, pdfBase64 } = req.body || {};
    // Obtener configuración del tenant (si existe) para SMTP: lab_configuration.integrations_settings.smtp
    let tenantSmtp = null;
    try {
      const cfgRes = await ap.query('SELECT integrations_settings FROM lab_configuration ORDER BY created_at ASC LIMIT 1');
      const integ = cfgRes.rows[0]?.integrations_settings || {};
      // Se espera que el admin haya guardado vía PATCH /api/config/integrations un objeto { smtp: { host, port, secure, user, pass, from } }
      tenantSmtp = integ.smtp || null;
    } catch (cfgErr) {
      console.warn('[EMAIL_ENDPOINT_CFG_FETCH_FAIL]', cfgErr.code || cfgErr.message);
    }

    // 1) Derivar SMTP desde ENV por defecto (opción A: Gmail) si no viene en el body
    const parseBool = (v) => {
      if (typeof v === 'boolean') return v;
      const s = String(v || '').toLowerCase();
      return s === '1' || s === 'true' || s === 'yes';
    };
    // Prioridad de origen SMTP: body > tenant config > ENV > defaults
    const smtpCandidate = {
      host: smtpIn?.host ?? tenantSmtp?.host ?? process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(smtpIn?.port ?? tenantSmtp?.port ?? process.env.SMTP_PORT ?? 587),
      secure: (smtpIn && typeof smtpIn.secure !== 'undefined')
        ? Boolean(smtpIn.secure)
        : (tenantSmtp && typeof tenantSmtp.secure !== 'undefined')
          ? Boolean(tenantSmtp.secure)
          : parseBool(process.env.SMTP_SECURE || '0'),
      user: smtpIn?.user ?? tenantSmtp?.user ?? process.env.SMTP_USER,
      pass: smtpIn?.pass ?? tenantSmtp?.pass ?? process.env.SMTP_PASS,
      from: smtpIn?.from ?? tenantSmtp?.from ?? process.env.SMTP_FROM ?? (smtpIn?.user || tenantSmtp?.user || process.env.SMTP_USER),
      replyTo: smtpIn?.replyTo ?? tenantSmtp?.replyTo ?? (process.env.SMTP_REPLY_TO || undefined),
    };
    const smtp = smtpCandidate;
    if (!smtp.user || !smtp.pass) {
      return next(new AppError(400, 'SMTP no configurado (faltan USER/PASS). Configure variables SMTP_* o envíe credenciales en el body.', 'SMTP_NOT_CONFIGURED'));
    }

    // 2) Derivar destinatario si no se proporciona: usar email del paciente
    let to = toRaw;
    let patient = patientIn;
    if (!to || !patient || !patient.full_name) {
      try {
        const { rows: pRows } = await ap.query('SELECT id, full_name, email, sex FROM patients WHERE id=$1', [order.patient_id]);
        const p = pRows[0] || {};
        patient = patient || { full_name: p.full_name || 'Paciente' };
        if (!to && p.email) to = p.email;
      } catch (_) { /* ignore lookup errors */ }
    }
    if (!to) {
      return next(new AppError(400, 'No se proporcionó destinatario y el paciente no tiene email.', 'NO_RECIPIENT'));
    }

    const labName = (req.body && req.body.labName) || 'Laboratorio Clínico';
    let pdfBuffer = null;
    if (pdfBase64 && typeof pdfBase64 === 'string') {
      try {
        pdfBuffer = Buffer.from(pdfBase64, 'base64');
      } catch (e) { console.warn('[EMAIL_ENDPOINT] Invalid base64 provided', e.message); }
    }

    let sendResult;
    try {
      sendResult = await sendReportEmail({ smtp, to, order, patient: patient || { full_name: 'Paciente' }, labName, from: smtp.from, pdfBuffer });
    } catch (e) {
      console.error('[EMAIL_SEND_FAIL]', e.message);
      return next(new AppError(500, 'Fallo envío email', 'EMAIL_SEND_FAIL'));
    }
    return res.json({ ok: true, channel: 'email', sendResult });
  } catch (e) {
    console.error('[EMAIL_REPORT_ENDPOINT_FAIL]', e);
    return next(new AppError(500, 'Error procesando envío', 'EMAIL_REPORT_ENDPOINT_FAIL'));
  }
});

// VALIDATE (atomic finalize of results) -> sets status Reportada + results_finalized true (if column exists / creates it)
router.post('/:id/validate', auth, requirePermission('orders', 'enter_results'), audit('update', 'work_order', req => req.params.id, () => ({ action: 'validate' })), async (req, res, next) => {
  try {
    let cols = await ensureWorkOrderColumns(req);
    // ensure results_finalized column exists
    if (!cols.has('results_finalized')) {
      try {
        await activePool(req).query('ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS results_finalized boolean DEFAULT false');
        workOrderColumns = null; cols = await ensureWorkOrderColumns(req);
        console.log('[WORK_ORDERS_ADD_COLUMN] results_finalized añadida durante VALIDATE');
      } catch (e) { console.warn('[WORK_ORDERS_ADD_COLUMN_FAIL][VALIDATE][results_finalized]', e.code || e.message); }
    }
    const ap = activePool(req);
    const { rows } = await ap.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    const order = rows[0];
    if (!order) return next(new AppError(404, 'Orden no encontrada', 'ORDER_NOT_FOUND'));
    if (!order.results || Object.keys(order.results || {}).length === 0) {
      return next(new AppError(400, 'No hay resultados para validar', 'NO_RESULTS_TO_VALIDATE'));
    }
    if (order.status === 'Reportada' && (order.results_finalized === true || !cols.has('results_finalized'))) {
      return res.json(order); // idempotent
    }
    const wantsFinalize = cols.has('results_finalized');
    const updates = ['status=$1'];
    const values = ['Reportada'];
    if (wantsFinalize) { updates.push(`results_finalized=$${values.length + 1}`); values.push(true); }
    values.push(req.params.id);
    const { rows: upd } = await ap.query(`UPDATE work_orders SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`, values);
    return res.json(upd[0]);
  } catch (e) {
    console.error('[ORDER_VALIDATE_FAIL]', e.code || e.message, e.detail || '');
    return next(new AppError(500, 'Error validando resultados', 'ORDER_VALIDATE_FAIL'));
  }
});

// REOPEN for correction (only if already validated/delivered) -> status Procesando + results_finalized=false
router.post('/:id/reopen', auth, requirePermission('orders', 'enter_results'), audit('update', 'work_order', req => req.params.id, () => ({ action: 'reopen' })), async (req, res, next) => {
  try {
    let cols = await ensureWorkOrderColumns(req);
    const ap = activePool(req);
    const { rows } = await ap.query('SELECT * FROM work_orders WHERE id=$1', [req.params.id]);
    const order = rows[0];
    if (!order) return next(new AppError(404, 'Orden no encontrada', 'ORDER_NOT_FOUND'));
    if (order.status !== 'Reportada' && order.status !== 'Entregada') {
      return next(new AppError(400, 'Sólo órdenes reportadas/entregadas pueden reabrirse', 'ORDER_REOPEN_INVALID_STATE'));
    }
    const wantsFinalize = cols.has('results_finalized');
    if (wantsFinalize) {
      const { rows: upd } = await ap.query('UPDATE work_orders SET status=$1, results_finalized=false WHERE id=$2 RETURNING *', ['Procesando', req.params.id]);
      return res.json(upd[0]);
    } else {
      const { rows: upd } = await ap.query('UPDATE work_orders SET status=$1 WHERE id=$2 RETURNING *', ['Procesando', req.params.id]);
      return res.json(upd[0]);
    }
  } catch (e) {
    console.error('[ORDER_REOPEN_FAIL]', e.code || e.message, e.detail || '');
    return next(new AppError(500, 'Error reabriendo orden', 'ORDER_REOPEN_FAIL'));
  }
});

module.exports = router;
