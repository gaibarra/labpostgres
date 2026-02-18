const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate } = require('../middleware/validate');
const { AppError } = require('../utils/errors');
const { audit } = require('../middleware/audit');
const { createQuoteSchema, updateQuoteSchema } = require('../validation/schemas');

const router = express.Router();
function activePool(req) { return req.tenantPool || pool; }

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatQuoteNumber(seq) {
  return `COT-${String(seq).padStart(4, '0')}`;
}

async function generateNextQuoteNumber(ap) {
  await ap.query("SELECT pg_advisory_xact_lock(hashtext('quotes.quote_number'))");
  const { rows } = await ap.query(
    `SELECT COALESCE(MAX((regexp_match(quote_number, '^COT-(\\d+)$'))[1]::int), 0) AS max_seq
     FROM quotes
     WHERE quote_number ~ '^COT-(\\d+)$'`
  );
  const next = (rows[0]?.max_seq || 0) + 1;
  return formatQuoteNumber(next);
}

function normalizeItems(items = []) {
  return items.map((item, index) => {
    const basePrice = toNumber(item.base_price ?? item.basePrice ?? item.precio_base ?? item.price, 0);
    let discountAmount = toNumber(item.discount_amount ?? item.discountAmount ?? 0, 0);
    let discountPercent = toNumber(item.discount_percent ?? item.discountPercent ?? 0, 0);

    if (discountAmount <= 0 && discountPercent > 0) {
      discountAmount = (basePrice * discountPercent) / 100;
    } else if (discountPercent <= 0 && discountAmount > 0 && basePrice > 0) {
      discountPercent = (discountAmount / basePrice) * 100;
    }

    let finalPrice = toNumber(item.final_price ?? item.finalPrice ?? (basePrice - discountAmount), basePrice - discountAmount);
    if (finalPrice < 0) finalPrice = 0;

    return {
      item_type: item.item_type || item.type || 'study',
      item_id: item.item_id || item.id,
      item_name: item.item_name || item.nombre || item.name || null,
      base_price: basePrice,
      discount_amount: discountAmount,
      discount_percent: discountPercent,
      final_price: finalPrice,
      position: Number.isFinite(Number(item.position)) ? Number(item.position) : index + 1,
    };
  });
}

function calculateTotals(items, descuento, descuentoPercent) {
  const subtotal = items.reduce((sum, item) => sum + toNumber(item.final_price, 0), 0);
  let discountAmount = toNumber(descuento, 0);
  let discountPercent = toNumber(descuentoPercent, 0);

  if (discountAmount <= 0 && discountPercent > 0) {
    discountAmount = (subtotal * discountPercent) / 100;
  } else if (discountPercent <= 0 && discountAmount > 0 && subtotal > 0) {
    discountPercent = (discountAmount / subtotal) * 100;
  }

  if (discountAmount > subtotal) discountAmount = subtotal;
  const total = subtotal - discountAmount;
  return {
    subtotal,
    descuento: discountAmount,
    descuento_percent: discountPercent,
    total_price: total,
  };
}

async function createQuoteVersion(ap, { quoteId, status, snapshot, userId, items }) {
  const { rows } = await ap.query('SELECT COALESCE(MAX(version_number), 0)::int AS max_version FROM quote_versions WHERE quote_id=$1', [quoteId]);
  const versionNumber = (rows[0]?.max_version || 0) + 1;
  const versionInsert = await ap.query(
    'INSERT INTO quote_versions (quote_id, version_number, status, snapshot, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [quoteId, versionNumber, status || null, snapshot || {}, userId || null]
  );
  const versionId = versionInsert.rows[0].id;
  if (items && items.length) {
    const values = [];
    const params = [];
    items.forEach((item, idx) => {
      const baseIndex = idx * 9;
      values.push(`($${baseIndex + 1},$${baseIndex + 2},$${baseIndex + 3},$${baseIndex + 4},$${baseIndex + 5},$${baseIndex + 6},$${baseIndex + 7},$${baseIndex + 8},$${baseIndex + 9})`);
      params.push(
        versionId,
        item.item_type,
        item.item_id,
        item.item_name,
        item.base_price,
        item.discount_amount,
        item.discount_percent,
        item.final_price,
        item.position
      );
    });
    await ap.query(
      `INSERT INTO quote_version_items (quote_version_id, item_type, item_id, item_name, base_price, discount_amount, discount_percent, final_price, position)
       VALUES ${values.join(',')}`,
      params
    );
  }
  return versionId;
}

async function updateReferrerPriceList(ap, referrerId, items) {
  if (!referrerId || !items?.length) return;
  const { rows } = await ap.query('SELECT listaprecios FROM referring_entities WHERE id=$1', [referrerId]);
  const listaprecios = rows[0]?.listaprecios && typeof rows[0].listaprecios === 'object' ? rows[0].listaprecios : { studies: [], packages: [] };
  const updated = {
    studies: Array.isArray(listaprecios.studies) ? [...listaprecios.studies] : [],
    packages: Array.isArray(listaprecios.packages) ? [...listaprecios.packages] : [],
  };

  items.forEach(item => {
    const key = item.item_type === 'package' ? 'packages' : 'studies';
    const target = updated[key];
    const idx = target.findIndex(entry => entry.itemId === item.item_id);
    if (idx >= 0) {
      target[idx] = { ...target[idx], price: item.final_price };
    } else {
      target.push({ itemId: item.item_id, price: item.final_price });
    }
  });

  await ap.query('UPDATE referring_entities SET listaprecios=$1 WHERE id=$2', [updated, referrerId]);
}

// LIST
router.get('/', auth, requirePermission('quotes', 'read'), async (req, res, next) => {
  const parsePositiveInt = (val, fallback) => {
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const page = Math.max(parsePositiveInt(req.query.page, 1), 1);
  const pageSize = Math.min(Math.max(parsePositiveInt(req.query.pageSize, 50), 1), 1000);
  const offset = (page - 1) * pageSize;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const params = [];
  const filters = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    filters.push(`(
      LOWER(COALESCE(q.quote_number,'')) LIKE $${params.length}
      OR LOWER(COALESCE(r.name,'')) LIKE $${params.length}
    )`);
  }
  if (status) {
    params.push(status);
    filters.push(`q.status = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const ap = activePool(req);
    const countSql = `SELECT COUNT(*)::int AS total FROM quotes q LEFT JOIN referring_entities r ON r.id = q.referring_entity_id ${where}`;
    const { rows: countRows } = await ap.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT q.*, r.name AS referrer_name, r.entity_type AS referrer_type
      FROM quotes q
      LEFT JOIN referring_entities r ON r.id = q.referring_entity_id
      ${where}
      ORDER BY q.quote_date DESC NULLS LAST, q.created_at DESC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const { rows } = await ap.query(dataSql, [...params, pageSize, offset]);

    res.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasMore: page * pageSize < total,
        search: search || null,
        status: status || null,
      }
    });
  } catch (e) {
    console.error('[QUOTE_LIST_FAIL]', e);
    next(new AppError(500, 'Error listando cotizaciones', 'QUOTE_LIST_FAIL'));
  }
});

// GET ONE
router.get('/:id', auth, requirePermission('quotes', 'read'), async (req, res, next) => {
  try {
    const ap = activePool(req);
    const quoteRes = await ap.query(
      `SELECT q.*, r.name AS referrer_name, r.entity_type AS referrer_type
       FROM quotes q
       LEFT JOIN referring_entities r ON r.id = q.referring_entity_id
       WHERE q.id=$1`,
      [req.params.id]
    );
    if (!quoteRes.rows[0]) return next(new AppError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND'));
    const itemsRes = await ap.query('SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY position ASC, created_at ASC', [req.params.id]);
    res.json({ ...quoteRes.rows[0], items: itemsRes.rows });
  } catch (e) {
    console.error('[QUOTE_GET_FAIL]', e);
    next(new AppError(500, 'Error obteniendo cotización', 'QUOTE_GET_FAIL'));
  }
});

// CREATE
router.post('/', auth, requirePermission('quotes', 'create'), validate(createQuoteSchema), audit('create', 'quote', (_req, res) => res.locals?.createdId, (req) => ({ body: req.body })), async (req, res, next) => {
  const { referring_entity_id, status, quote_date, expires_at, notes } = req.body || {};
  const items = normalizeItems(req.body?.items || []);
  const totals = calculateTotals(items, req.body?.descuento, req.body?.descuento_percent);
  const ap = activePool(req);

  try {
    await ap.query('BEGIN');
    const quote_number = await generateNextQuoteNumber(ap);
    const insertQuote = await ap.query(
      `INSERT INTO quotes (quote_number, referring_entity_id, status, quote_date, expires_at, subtotal, descuento, descuento_percent, total_price, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        quote_number || null,
        referring_entity_id || null,
        status || 'Borrador',
        quote_date || null,
        expires_at || null,
        totals.subtotal,
        totals.descuento,
        totals.descuento_percent,
        totals.total_price,
        notes || null,
      ]
    );
    const quote = insertQuote.rows[0];
    res.locals.createdId = quote.id;

    if (items.length) {
      const values = [];
      const params = [];
      items.forEach((item, idx) => {
        const baseIndex = idx * 9;
        values.push(`($${baseIndex + 1},$${baseIndex + 2},$${baseIndex + 3},$${baseIndex + 4},$${baseIndex + 5},$${baseIndex + 6},$${baseIndex + 7},$${baseIndex + 8},$${baseIndex + 9})`);
        params.push(
          quote.id,
          item.item_type,
          item.item_id,
          item.item_name,
          item.base_price,
          item.discount_amount,
          item.discount_percent,
          item.final_price,
          item.position
        );
      });
      await ap.query(
        `INSERT INTO quote_items (quote_id, item_type, item_id, item_name, base_price, discount_amount, discount_percent, final_price, position)
         VALUES ${values.join(',')}`,
        params
      );
    }

    const snapshot = {
      quote: {
        quote_number: quote.quote_number,
        referring_entity_id: quote.referring_entity_id,
        status: quote.status,
        quote_date: quote.quote_date,
        expires_at: quote.expires_at,
        subtotal: quote.subtotal,
        descuento: quote.descuento,
        descuento_percent: quote.descuento_percent,
        total_price: quote.total_price,
        notes: quote.notes,
      },
      items,
    };
    await createQuoteVersion(ap, { quoteId: quote.id, status: quote.status, snapshot, userId: req.user?.id, items });

    await ap.query('COMMIT');

    res.status(201).json({ ...quote, items });
  } catch (e) {
    try { await ap.query('ROLLBACK'); } catch (_) { /* noop */ }
    console.error('[QUOTE_CREATE_FAIL]', e);
    next(new AppError(500, 'Error creando cotización', 'QUOTE_CREATE_FAIL'));
  }
});

// UPDATE
router.put('/:id', auth, requirePermission('quotes', 'update'), validate(updateQuoteSchema), audit('update', 'quote', req => req.params.id, (req) => ({ body: req.body })), async (req, res, next) => {
  const quoteId = req.params.id;
  const ap = activePool(req);
  try {
    const { rows: baseRows } = await ap.query('SELECT * FROM quotes WHERE id=$1', [quoteId]);
    if (!baseRows[0]) return next(new AppError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND'));
    const current = baseRows[0];
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'quote_number')) {
      return next(new AppError(400, 'El folio de cotización se genera automáticamente y no se puede editar', 'QUOTE_NUMBER_LOCKED'));
    }
    const hasField = (field) => Object.prototype.hasOwnProperty.call(req.body || {}, field);

    if (current.status === 'Aceptada') {
      const restrictedFields = [
        'quote_number',
        'referring_entity_id',
        'status',
        'quote_date',
        'expires_at',
        'notes',
        'descuento',
        'descuento_percent',
        'subtotal',
        'total_price',
        'items'
      ];
      if (restrictedFields.some(hasField)) {
        return next(new AppError(400, 'No se permite editar cotizaciones aceptadas', 'QUOTE_EDIT_LOCKED'));
      }
    }

    const itemsProvided = Array.isArray(req.body?.items);
    const items = itemsProvided ? normalizeItems(req.body.items) : null;

    const mergedItems = itemsProvided ? items : (await ap.query('SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY position ASC', [quoteId])).rows;
    const totals = calculateTotals(mergedItems, req.body?.descuento ?? current.descuento, req.body?.descuento_percent ?? current.descuento_percent);

    const fields = ['quote_number','referring_entity_id','status','quote_date','expires_at','notes'];
    const sets = [];
    const values = [];
    fields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        sets.push(`${field}=$${sets.length + 1}`);
        values.push(req.body[field]);
      }
    });

    sets.push(`subtotal=$${sets.length + 1}`); values.push(totals.subtotal);
    sets.push(`descuento=$${sets.length + 1}`); values.push(totals.descuento);
    sets.push(`descuento_percent=$${sets.length + 1}`); values.push(totals.descuento_percent);
    sets.push(`total_price=$${sets.length + 1}`); values.push(totals.total_price);

    values.push(quoteId);
    const updateSql = `UPDATE quotes SET ${sets.join(', ')} WHERE id=$${values.length} RETURNING *`;
    const { rows: updatedRows } = await ap.query(updateSql, values);
    const updatedQuote = updatedRows[0];

    if (itemsProvided) {
      await ap.query('DELETE FROM quote_items WHERE quote_id=$1', [quoteId]);
      if (items.length) {
        const insertValues = [];
        const insertParams = [];
        items.forEach((item, idx) => {
          const baseIndex = idx * 9;
          insertValues.push(`($${baseIndex + 1},$${baseIndex + 2},$${baseIndex + 3},$${baseIndex + 4},$${baseIndex + 5},$${baseIndex + 6},$${baseIndex + 7},$${baseIndex + 8},$${baseIndex + 9})`);
          insertParams.push(
            quoteId,
            item.item_type,
            item.item_id,
            item.item_name,
            item.base_price,
            item.discount_amount,
            item.discount_percent,
            item.final_price,
            item.position
          );
        });
        await ap.query(
          `INSERT INTO quote_items (quote_id, item_type, item_id, item_name, base_price, discount_amount, discount_percent, final_price, position)
           VALUES ${insertValues.join(',')}`,
          insertParams
        );
      }
    }

    const snapshot = {
      quote: {
        quote_number: updatedQuote.quote_number,
        referring_entity_id: updatedQuote.referring_entity_id,
        status: updatedQuote.status,
        quote_date: updatedQuote.quote_date,
        expires_at: updatedQuote.expires_at,
        subtotal: updatedQuote.subtotal,
        descuento: updatedQuote.descuento,
        descuento_percent: updatedQuote.descuento_percent,
        total_price: updatedQuote.total_price,
        notes: updatedQuote.notes,
      },
      items: itemsProvided ? items : mergedItems,
    };
    await createQuoteVersion(ap, { quoteId, status: updatedQuote.status, snapshot, userId: req.user?.id, items: itemsProvided ? items : mergedItems });

    res.json({ ...updatedQuote, items: itemsProvided ? items : mergedItems });
  } catch (e) {
    console.error('[QUOTE_UPDATE_FAIL]', e);
    next(new AppError(500, 'Error actualizando cotización', 'QUOTE_UPDATE_FAIL'));
  }
});

// DELETE
router.delete('/:id', auth, requirePermission('quotes', 'delete'), audit('delete', 'quote', req => req.params.id, () => ({ action: 'delete' })), async (req, res, next) => {
  const quoteId = req.params.id;
  const ap = activePool(req);
  try {
    const { rows } = await ap.query('SELECT id, status FROM quotes WHERE id=$1', [quoteId]);
    if (!rows[0]) return next(new AppError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND'));
    if (rows[0].status === 'Aceptada') {
      return next(new AppError(400, 'No se permite eliminar cotizaciones aceptadas', 'QUOTE_DELETE_LOCKED'));
    }

    await ap.query('BEGIN');
    await ap.query('DELETE FROM quote_items WHERE quote_id=$1', [quoteId]);
    const { rows: versionRows } = await ap.query('SELECT id FROM quote_versions WHERE quote_id=$1', [quoteId]);
    if (versionRows.length) {
      const versionIds = versionRows.map(r => r.id);
      await ap.query('DELETE FROM quote_version_items WHERE quote_version_id = ANY($1::uuid[])', [versionIds]);
      await ap.query('DELETE FROM quote_versions WHERE quote_id=$1', [quoteId]);
    }
    await ap.query('DELETE FROM quotes WHERE id=$1', [quoteId]);
    await ap.query('COMMIT');

    res.json({ ok: true });
  } catch (e) {
    await ap.query('ROLLBACK');
    console.error('[QUOTE_DELETE_FAIL]', e);
    next(new AppError(500, 'Error eliminando cotización', 'QUOTE_DELETE_FAIL'));
  }
});

// SEND (mark sent)
router.post('/:id/send', auth, requirePermission('quotes', 'send'), audit('send', 'quote', req => req.params.id, (req) => ({ action: 'send', reason: req.body?.reason || null })), async (req, res, next) => {
  const quoteId = req.params.id;
  const ap = activePool(req);
  try {
    const { rows: baseRows } = await ap.query('SELECT status FROM quotes WHERE id=$1', [quoteId]);
    if (!baseRows[0]) return next(new AppError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND'));
    if (baseRows[0].status === 'Aceptada') {
      return next(new AppError(400, 'No se permite editar cotizaciones aceptadas', 'QUOTE_EDIT_LOCKED'));
    }
    const { rows } = await ap.query('UPDATE quotes SET status=$1 WHERE id=$2 RETURNING *', ['Enviada', quoteId]);
    const itemsRes = await ap.query('SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY position ASC', [quoteId]);
    const snapshot = { quote: rows[0], items: itemsRes.rows };
    await createQuoteVersion(ap, { quoteId, status: 'Enviada', snapshot, userId: req.user?.id, items: itemsRes.rows });
    res.json({ ...rows[0], items: itemsRes.rows });
  } catch (e) {
    console.error('[QUOTE_SEND_FAIL]', e);
    next(new AppError(500, 'Error enviando cotización', 'QUOTE_SEND_FAIL'));
  }
});

// ACCEPT
router.post('/:id/accept', auth, requirePermission('quotes', 'accept'), audit('accept', 'quote', req => req.params.id, (req) => ({ action: 'accept' })), async (req, res, next) => {
  const quoteId = req.params.id;
  const ap = activePool(req);
  try {
    const { rows } = await ap.query('UPDATE quotes SET status=$1 WHERE id=$2 RETURNING *', ['Aceptada', quoteId]);
    if (!rows[0]) return next(new AppError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND'));
    const itemsRes = await ap.query('SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY position ASC', [quoteId]);
    await updateReferrerPriceList(ap, rows[0].referring_entity_id, itemsRes.rows);
    const snapshot = { quote: rows[0], items: itemsRes.rows };
    await createQuoteVersion(ap, { quoteId, status: 'Aceptada', snapshot, userId: req.user?.id, items: itemsRes.rows });
    res.json({ ...rows[0], items: itemsRes.rows });
  } catch (e) {
    console.error('[QUOTE_ACCEPT_FAIL]', e);
    next(new AppError(500, 'Error aceptando cotización', 'QUOTE_ACCEPT_FAIL'));
  }
});

// EXPIRE
router.post('/:id/expire', auth, requirePermission('quotes', 'update'), audit('expire', 'quote', req => req.params.id, () => ({ action: 'expire' })), async (req, res, next) => {
  const quoteId = req.params.id;
  const ap = activePool(req);
  try {
    const { rows: baseRows } = await ap.query('SELECT status FROM quotes WHERE id=$1', [quoteId]);
    if (!baseRows[0]) return next(new AppError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND'));
    if (baseRows[0].status === 'Aceptada') {
      return next(new AppError(400, 'No se permite editar cotizaciones aceptadas', 'QUOTE_EDIT_LOCKED'));
    }
    const { rows } = await ap.query('UPDATE quotes SET status=$1 WHERE id=$2 RETURNING *', ['Expirada', quoteId]);
    const itemsRes = await ap.query('SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY position ASC', [quoteId]);
    const snapshot = { quote: rows[0], items: itemsRes.rows };
    await createQuoteVersion(ap, { quoteId, status: 'Expirada', snapshot, userId: req.user?.id, items: itemsRes.rows });
    res.json({ ...rows[0], items: itemsRes.rows });
  } catch (e) {
    console.error('[QUOTE_EXPIRE_FAIL]', e);
    next(new AppError(500, 'Error expirando cotización', 'QUOTE_EXPIRE_FAIL'));
  }
});

// EXTEND (prórroga)
router.post('/:id/extend', auth, requirePermission('quotes', 'extend'), audit('extend', 'quote', req => req.params.id, (req) => ({ action: 'extend', expires_at: req.body?.expires_at })), async (req, res, next) => {
  const quoteId = req.params.id;
  const { expires_at } = req.body || {};
  if (!expires_at) return next(new AppError(400, 'expires_at requerido', 'QUOTE_EXTEND_REQUIRED'));
  const ap = activePool(req);
  try {
    const { rows: baseRows } = await ap.query('SELECT status FROM quotes WHERE id=$1', [quoteId]);
    if (!baseRows[0]) return next(new AppError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND'));
    if (baseRows[0].status === 'Aceptada') {
      return next(new AppError(400, 'No se permite editar cotizaciones aceptadas', 'QUOTE_EDIT_LOCKED'));
    }
    const { rows } = await ap.query('UPDATE quotes SET expires_at=$1 WHERE id=$2 RETURNING *', [expires_at, quoteId]);
    const itemsRes = await ap.query('SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY position ASC', [quoteId]);
    const snapshot = { quote: rows[0], items: itemsRes.rows };
    await createQuoteVersion(ap, { quoteId, status: rows[0].status, snapshot, userId: req.user?.id, items: itemsRes.rows });
    res.json({ ...rows[0], items: itemsRes.rows });
  } catch (e) {
    console.error('[QUOTE_EXTEND_FAIL]', e);
    next(new AppError(500, 'Error prorrogando cotización', 'QUOTE_EXTEND_FAIL'));
  }
});

// VERSIONS (latest two)
router.get('/:id/versions', auth, requirePermission('quotes', 'view_history'), async (req, res, next) => {
  const quoteId = req.params.id;
  const ap = activePool(req);
  try {
    const { rows } = await ap.query(
      'SELECT * FROM quote_versions WHERE quote_id=$1 ORDER BY version_number DESC LIMIT 2',
      [quoteId]
    );
    const versionIds = rows.map(r => r.id);
    let itemsByVersion = {};
    if (versionIds.length) {
      const { rows: itemsRows } = await ap.query(
        'SELECT * FROM quote_version_items WHERE quote_version_id = ANY($1::uuid[])',
        [versionIds]
      );
      itemsRows.forEach(item => {
        if (!itemsByVersion[item.quote_version_id]) itemsByVersion[item.quote_version_id] = [];
        itemsByVersion[item.quote_version_id].push(item);
      });
    }
    res.json({
      versions: rows.map(row => ({ ...row, items: itemsByVersion[row.id] || [] }))
    });
  } catch (e) {
    console.error('[QUOTE_VERSIONS_FAIL]', e);
    next(new AppError(500, 'Error obteniendo versiones', 'QUOTE_VERSIONS_FAIL'));
  }
});

// EVENTS
router.get('/:id/events', auth, requirePermission('quotes', 'view_history'), async (req, res, next) => {
  const quoteId = req.params.id;
  const ap = activePool(req);
  try {
    const { rows } = await ap.query(
      `SELECT id, action, details, performed_by, created_at
       FROM system_audit_logs
       WHERE entity = 'quote' AND entity_id = $1
       ORDER BY created_at DESC`,
      [quoteId]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('[QUOTE_EVENTS_FAIL]', e);
    next(new AppError(500, 'Error obteniendo eventos', 'QUOTE_EVENTS_FAIL'));
  }
});

module.exports = router;
