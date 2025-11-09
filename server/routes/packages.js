const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { parsePagination, buildSearchFilter } = require('../utils/pagination');
const { AppError } = require('../utils/errors');
const { randomUUID, randomBytes } = require('crypto');

// UUID seguro compatible con Node antiguos (sin crypto.randomUUID)
function safeUUID(){
  if (typeof randomUUID === 'function') return randomUUID();
  const buf = randomBytes(16);
  // RFC4122 v4
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = buf.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

const router = express.Router();
const { validate } = require('../middleware/validate');
const { packageCreateSchema, packageUpdateSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');
const { sanitizeBody } = require('../middleware/sanitize');
function activePool(req){ return req.tenantPool || pool; }

router.get('/', auth, requirePermission('packages','read'), async (req,res,next)=>{ try {
  const { limit, offset } = parsePagination(req.query);
  // Buscar por nombre y descripción para soporte de selección amplia
  const { clause, params } = buildSearchFilter(req.query.search,['name','description']);
  let base='FROM analysis_packages'; if(clause) base+=' WHERE '+clause;
  const rowsQ=`SELECT * ${base} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  const cntQ=`SELECT COUNT(*)::int AS total ${base}`;
  const [r,c]=await Promise.all([
    activePool(req).query(rowsQ.replace(/\$SEARCH/g,'$'),[...params,limit,offset]),
    activePool(req).query(cntQ.replace(/\$SEARCH/g,'$'),params)
  ]);
  res.json({ data:r.rows, page:{ limit, offset, total:c.rows[0].total }});
} catch(e){ console.error(e); next(new AppError(500,'Error listando paquetes','PACKAGE_LIST_FAIL'));} });

// Detailed packages including items aggregated
router.get('/detailed', auth, requirePermission('packages','read'), async (req,res,next)=>{
  try {
    const { limit, offset } = parsePagination(req.query);
    const { clause, params } = buildSearchFilter(req.query.search,['name','description']);
    const where = clause ? ` WHERE ${clause}` : '';
    // Detectar si existe la tabla items
    const { rows: existsRows } = await activePool(req).query(`SELECT 1 FROM information_schema.tables WHERE table_name='analysis_package_items' LIMIT 1`);
    const hasItems = existsRows.length === 1;
    let data = [];
    let total = 0;
    if (hasItems) {
      const q = `
        SELECT p.*, COALESCE(items.items,'[]') AS items
        FROM analysis_packages p
        LEFT JOIN LATERAL (
          SELECT json_agg(
            json_build_object(
              'id', i.id,
              'item_id', i.item_id,
              'item_type', i.item_type,
              'position', i.position,
              'name', CASE WHEN i.item_type='analysis' THEN a.name ELSE NULL END
            ) ORDER BY i.position NULLS LAST, i.created_at
          ) AS items
          FROM analysis_package_items i
          LEFT JOIN analysis a ON a.id = i.item_id AND i.item_type='analysis'
          WHERE i.package_id = p.id
        ) items ON true
        ${where}
        ORDER BY p.created_at DESC
        LIMIT $${params.length+1} OFFSET $${params.length+2}
      `;
      const cntQ = `SELECT COUNT(*)::int AS total FROM analysis_packages${where}`;
      const [rowsR, cntR] = await Promise.all([
        activePool(req).query(q, [...params, limit, offset]),
        activePool(req).query(cntQ, params)
      ]);
      data = rowsR.rows.map(pkg => ({
        ...pkg,
        items: (pkg.items || []).map(it => ({ ...it, name: it.name || 'Item desconocido' }))
      }));
      total = cntR.rows[0].total;
    } else {
      const q2 = `SELECT * FROM analysis_packages${where} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
      const cntQ2 = `SELECT COUNT(*)::int AS total FROM analysis_packages${where}`;
      const [rowsR2, cntR2] = await Promise.all([
        activePool(req).query(q2, [...params, limit, offset]),
        activePool(req).query(cntQ2, params)
      ]);
      data = rowsR2.rows.map(p => ({ ...p, items: [] }));
      total = cntR2.rows[0].total;
    }
    res.json({ data, page: { limit, offset, total } });
  } catch(e){ console.error(e); next(new AppError(500,'Error listando paquetes detallados','PACKAGE_DETAILED_LIST_FAIL')); }
});

router.get('/count', auth, requirePermission('packages','read'), async (req,res,next)=>{
  try { const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS total FROM analysis_packages'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando paquetes','PACKAGE_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('packages','read'), async (req,res,next)=>{
  try { const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS total FROM analysis_packages'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando paquetes','PACKAGE_COUNT_FAIL')); }
});

router.post('/', auth, requirePermission('packages','create'), sanitizeBody(['name','description']), validate(packageCreateSchema), audit('create','package', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{ const { name, description, price } = req.body || {}; try { const { rows } = await activePool(req).query('INSERT INTO analysis_packages(name, description, price) VALUES($1,$2,$3) RETURNING *',[name,description||null,price||null]); const created=rows[0]; res.locals.createdId = created.id; res.status(201).json(created); } catch(e){ console.error(e); next(new AppError(500,'Error creando paquete','PACKAGE_CREATE_FAIL'));} });

router.get('/:id/items', auth, requirePermission('packages','read'), async (req,res,next)=>{
  try {
    // Detectar si existe la tabla y la columna position (compatibilidad con tenants legacy)
    const pool = activePool(req);
    const { rows: tExists } = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='analysis_package_items' LIMIT 1`);
    if (!tExists.length) return next(new AppError(500,'Tabla analysis_package_items no existe en el esquema del tenant','PACKAGE_ITEMS_TABLE_MISSING'));
    const { rows: cExists } = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='analysis_package_items' AND column_name='position' LIMIT 1`);
    const hasPosition = !!cExists.length;
    const q = hasPosition
      ? `SELECT i.*, CASE WHEN i.item_type='analysis' THEN a.name ELSE NULL END AS name
         FROM analysis_package_items i
         LEFT JOIN analysis a ON a.id = i.item_id AND i.item_type='analysis'
         WHERE i.package_id = $1
         ORDER BY i.position NULLS LAST, i.created_at`
      : `SELECT i.*, NULL::int AS position, CASE WHEN i.item_type='analysis' THEN a.name ELSE NULL END AS name
         FROM analysis_package_items i
         LEFT JOIN analysis a ON a.id = i.item_id AND i.item_type='analysis'
         WHERE i.package_id = $1
         ORDER BY i.created_at`;
    const { rows } = await pool.query(q, [req.params.id]);
    const data = rows.map(r => ({ ...r, name: r.name || 'Item desconocido' }));
    res.json(data);
  } catch(e){ console.error(e); next(new AppError(500,'Error listando items','PACKAGE_ITEMS_LIST_FAIL')); }
});

router.post('/:id/items', auth, requirePermission('packages','update'), audit('create','package_item', (req,r)=>r.locals?.pkgItemId, (req)=>({ body: req.body, package_id: req.params.id })), async (req,res,next)=>{
  const { item_id, item_type } = req.body || {};
  let { position } = req.body || {};
  if(!item_id) return next(new AppError(400,'item_id requerido','ITEM_ID_REQUIRED'));
  const pkgId = req.params.id;
  try {
    // Inyección de falla para pruebas: simular error app-side dentro del try externo
    if (process.env.NODE_ENV === 'test' && req.headers && req.headers['x-fault-insert']) {
      const mode = req.headers['x-fault-insert'];
      if (mode === 'throw') {
        throw new TypeError('fault-injected');
      }
    }
    const pool = activePool(req);
    // Compatibilidad: verificar columna position
    const { rows: tExists } = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='analysis_package_items' LIMIT 1`);
    if (!tExists.length) return next(new AppError(500,'Tabla analysis_package_items no existe en el esquema del tenant','PACKAGE_ITEMS_TABLE_MISSING'));
    const { rows: cExists } = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='analysis_package_items' AND column_name='position' LIMIT 1`);
    const hasPosition = !!cExists.length;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Fault injections dentro de la transacción para simular códigos PG
      if (process.env.NODE_ENV === 'test' && req.headers && req.headers['x-fault-insert']) {
        const mode = req.headers['x-fault-insert'];
        if (mode === 'deadlock') {
          const err = new Error('deadlock simulated'); err.code = '40P01'; throw err;
        }
        if (mode === 'missing-column') {
          const err = new Error('undefined column simulated'); err.code = '42703'; throw err;
        }
        if (mode === 'missing-function') {
          const err = new Error('undefined function simulated'); err.code = '42883'; throw err;
        }
        if (mode === 'position-conflict') {
          const err = new Error('unique violation simulated'); err.code = '23505'; err.constraint = 'uq_analysis_package_items_package_pos'; throw err;
        }
        if (mode === 'division-by-zero') {
          const err = new Error('division by zero simulated'); err.code = '22012'; throw err;
        }
      }
      let rows;
      if (hasPosition) {
  const id = safeUUID();
        // Normalizar position (entero >=1) si viene en el body
        if (position != null) {
          position = parseInt(position, 10);
          if (!Number.isInteger(position) || position < 1) {
            return next(new AppError(400,'position debe ser entero >= 1','BAD_POSITION'));
          }
          // Hacer espacio moviendo hacia abajo los existentes
          await client.query(
            'UPDATE analysis_package_items SET position = position + 1 WHERE package_id=$1 AND position >= $2',
            [pkgId, position]
          );
        } else {
          // Calcular siguiente posición
          const { rows: m } = await client.query('SELECT COALESCE(MAX(position),0)+1 AS next FROM analysis_package_items WHERE package_id=$1', [pkgId]);
          position = m[0]?.next || 1;
        }
        ({ rows } = await client.query(
          'INSERT INTO analysis_package_items(id,package_id,item_id,item_type,position) VALUES($1,$2,$3,$4,$5) RETURNING *',
          [id, pkgId, item_id, item_type||'analysis', position]
        ));
      } else {
  const id = safeUUID();
        // Legacy: sin columna position
        ({ rows } = await client.query(
          'INSERT INTO analysis_package_items(id,package_id,item_id,item_type) VALUES($1,$2,$3,$4) RETURNING *',
          [id, pkgId, item_id, item_type||'analysis']
        ));
      }
      await client.query('COMMIT');
      const created = rows[0];
      res.locals.pkgItemId = created.id;
      res.status(201).json(created);
    } catch (e) {
      await client.query('ROLLBACK');
      // Mapear violaciones de unicidad a 409 con código específico
      if (e && e.code === '23505') {
        // Detectar constraint para mensaje más claro
        if (e.constraint === 'analysis_package_items_package_id_item_id_item_type_key' || /\(package_id,\s*item_id,\s*item_type\)/i.test(e.detail||'')) {
          return next(new AppError(409, 'El ítem ya existe en este paquete', 'PACKAGE_ITEM_DUPLICATE'));
        }
        if (e.constraint === 'uq_analysis_package_items_package_pos' || /\(package_id,\s*"?position"?\)/i.test(e.detail||'')) {
          return next(new AppError(409, 'Posición ya ocupada en el paquete', 'PACKAGE_ITEM_POSITION_CONFLICT'));
        }
      }
        // Excepción definida por el usuario (RAISE EXCEPTION) P0001
        if (e && e.code === 'P0001') {
          return next(new AppError(400, 'Regla de negocio violada', 'PG_USER_EXCEPTION'));
        }
      // Violación de llave foránea: paquete inexistente o item inexistente
      if (e && e.code === '23503') {
        const detail = e.detail || '';
        if (/\(package_id\)/i.test(detail) || e.constraint === 'analysis_package_items_package_id_fkey') {
          return next(new AppError(404, 'Paquete no encontrado', 'PACKAGE_NOT_FOUND'));
        }
        if (/\(item_id\)/i.test(detail) || e.constraint === 'analysis_package_items_item_id_fkey') {
          return next(new AppError(404, 'Ítem no encontrado', 'PACKAGE_ITEM_TARGET_NOT_FOUND'));
        }
        // FK genérica
        return next(new AppError(404, 'Referencia no encontrada', 'FOREIGN_KEY_NOT_FOUND'));
      }
      // UUID mal formado en params/body
      if (e && e.code === '22P02') {
        return next(new AppError(400, 'Formato de UUID inválido', 'BAD_UUID'));
      }
      // Insufficient privilege / RLS violation
      if (e && e.code === '42501') {
        // Incluye casos como "new row violates row-level security policy for table"
        return next(new AppError(403, 'Permisos insuficientes para modificar este paquete', 'RLS_FORBIDDEN'));
      }
      // NOT NULL violation (23502)
      if (e && e.code === '23502') {
        const col = /"([^"]+)"/i.exec(e.column || e.detail || '')?.[1] || 'columna requerida';
        return next(new AppError(400, `Valor requerido faltante (${col})`, 'NOT_NULL_VIOLATION'));
      }
      // CHECK constraint violation (23514)
      if (e && e.code === '23514') {
        return next(new AppError(400, 'Violación de regla (CHECK constraint)', 'CHECK_CONSTRAINT_VIOLATION'));
      }
      // Deadlock (40P01) -> sugerir retry
      if (e && e.code === '40P01') {
        return next(new AppError(503, 'Deadlock detectado, intente nuevamente', 'DEADLOCK_RETRY'));
      }
        // Serialization failure (40001)
        if (e && e.code === '40001') {
          return next(new AppError(503, 'Conflicto transaccional, reintente', 'SERIALIZATION_RETRY'));
        }
        // Lock not available (55P03)
        if (e && e.code === '55P03') {
          return next(new AppError(503, 'Recurso bloqueado, reintente', 'LOCK_NOT_AVAILABLE'));
        }
        // Query cancelled (57014)
        if (e && e.code === '57014') {
          return next(new AppError(503, 'Operación cancelada', 'QUERY_CANCELLED'));
        }
      // Undefined table (42P01) dentro de la transacción (legacy tenant no migrado)
      if (e && e.code === '42P01') {
        return next(new AppError(500, 'Tabla items inexistente en este tenant (ejecutar migración)', 'PACKAGE_ITEMS_TABLE_MISSING'));
      }
      // Undefined column (42703) típicamente falta columna position
      if (e && e.code === '42703') {
        return next(new AppError(500, 'Columna esperada no existe (posible falta de migración)', 'PACKAGE_ITEMS_COLUMN_MISSING'));
      }
      // Undefined function (42883) posible falta de extensión uuid
      if (e && e.code === '42883') {
        return next(new AppError(500, 'Función requerida no disponible (verificar extensiones uuid/pgcrypto)', 'PG_FUNCTION_MISSING'));
      }
      // Cualquier otra integridad (23xxx) devolver conflicto genérico
      if (e && /^23/.test(e.code||'')) {
        return next(new AppError(409, 'Conflicto de integridad', 'UNIQUE_OR_INTEGRITY_CONFLICT'));
      }
        // Numeric out of range (22003)
        if (e && e.code === '22003') {
          return next(new AppError(400, 'Valor numérico fuera de rango', 'NUMERIC_OUT_OF_RANGE'));
        }
        // String data right truncation (22001)
        if (e && e.code === '22001') {
          return next(new AppError(400, 'Texto demasiado largo', 'STRING_DATA_TRUNCATED'));
        }
      // Log diagnóstico enriquecido para errores no clasificados
      console.error('[PACKAGE_ITEM_INSERT_ERROR]', {
        code: e.code,
        constraint: e.constraint,
        detail: (e.detail||'').slice(0,200),
          schema: e.schema || null,
          table: e.table || null,
          hint: e.hint || null,
        message: e.message,
        pkgId,
        item_id,
        item_type: item_type||'analysis',
        position,
        hasPosition
      });
      throw e;
    } finally {
      client.release();
    }
  } catch(e){
    console.error('[PACKAGE_ITEM_INSERT_OUTER_ERROR]', e && e.message, { code: e && e.code, pkgId });
    // Si viene una AppError previa, respetarla
    if (e && e.status && e.code) return next(e);
    // Mapeo adicional si el error ocurrió fuera de la transacción (e.g., consultas de existencia)
    if (e && e.code) {
      switch (e.code) {
        case '23505': return next(new AppError(409,'Conflicto de integridad','UNIQUE_OR_INTEGRITY_CONFLICT'));
        case '23503': return next(new AppError(404,'Referencia no encontrada','FOREIGN_KEY_NOT_FOUND'));
        case '22P02': return next(new AppError(400,'Formato de UUID inválido','BAD_UUID'));
        case '23502': return next(new AppError(400,'Valor requerido faltante','NOT_NULL_VIOLATION'));
        case '23514': return next(new AppError(400,'Violación de regla','CHECK_CONSTRAINT_VIOLATION'));
        case '40P01': return next(new AppError(503,'Deadlock detectado, intente nuevamente','DEADLOCK_RETRY'));
          case '40001': return next(new AppError(503,'Conflicto transaccional, reintente','SERIALIZATION_RETRY'));
          case '55P03': return next(new AppError(503,'Recurso bloqueado, reintente','LOCK_NOT_AVAILABLE'));
          case '57014': return next(new AppError(503,'Operación cancelada','QUERY_CANCELLED'));
        case '42P01': return next(new AppError(500,'Tabla items inexistente en este tenant (ejecutar migración)','PACKAGE_ITEMS_TABLE_MISSING'));
        case '42703': return next(new AppError(500,'Columna esperada no existe (posible falta de migración)','PACKAGE_ITEMS_COLUMN_MISSING'));
        case '42883': return next(new AppError(500,'Función requerida no disponible (verificar extensiones uuid/pgcrypto)','PG_FUNCTION_MISSING'));
        case '42501': return next(new AppError(403,'Permisos insuficientes para modificar este paquete','RLS_FORBIDDEN'));
          case '22003': return next(new AppError(400,'Valor numérico fuera de rango','NUMERIC_OUT_OF_RANGE'));
          case '22001': return next(new AppError(400,'Texto demasiado largo','STRING_DATA_TRUNCATED'));
          case 'P0001': return next(new AppError(400,'Regla de negocio violada','PG_USER_EXCEPTION'));
        default:
          if (/^23/.test(e.code)) return next(new AppError(409,'Conflicto de integridad','UNIQUE_OR_INTEGRITY_CONFLICT'));
      }
    }
    // Errores de red/DB comunes
    if (e && (e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET')) {
      return next(new AppError(503,'Problema de conexión con la base de datos','DB_CONNECTION_ERROR'));
    }
    // Caso genérico sin código (TypeError, etc.)
    if (!e || !e.code) {
      return next(new AppError(500,'Error interno procesando item','GENERIC_PACKAGE_ITEM_INTERNAL'));
    }
    next(new AppError(500,'Error agregando item','PACKAGE_ITEM_ADD_FAIL'));
  }
});

// Reordenar items de un paquete según un arreglo de IDs en el orden deseado
router.patch('/:id/items/reorder', auth, requirePermission('packages','update'), audit('update','package_items_reorder', req=>req.params.id, req=>({ body: req.body })), async (req,res,next)=>{
  try {
    const pkgId = req.params.id;
    let itemIds = req.body?.itemIds || req.body?.item_ids;
    if (!Array.isArray(itemIds) || itemIds.length === 0) return next(new AppError(400,'itemIds (array) requerido','ITEM_IDS_REQUIRED'));
    // Validar UUIDs simples (formato)
    if (!itemIds.every(id => typeof id === 'string' && /^[0-9a-fA-F-]{36}$/.test(id))) {
      return next(new AppError(400,'itemIds debe ser un arreglo de UUIDs','ITEM_IDS_BAD_FORMAT'));
    }
    const pool = activePool(req);
    // Compatibilidad: si no existe columna position, no soportamos reorder
    const { rows: cExists } = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='analysis_package_items' AND column_name='position' LIMIT 1`);
    const hasPosition = !!cExists.length;
    if (!hasPosition) return next(new AppError(501,'Este tenant aún no soporta reordenamiento (falta columna position)','PACKAGE_ITEMS_REORDER_NOT_SUPPORTED'));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Obtener los items actuales del paquete
      const { rows: current } = await client.query('SELECT id FROM analysis_package_items WHERE package_id=$1', [pkgId]);
      const currentIds = current.map(r=>r.id);
      // Comprobar que todos los itemIds pertenezcan al paquete
      const allBelong = itemIds.every(id => currentIds.includes(id));
      if (!allBelong) {
        return next(new AppError(400,'Todos los itemIds deben pertenecer al paquete','ITEM_IDS_NOT_IN_PACKAGE'));
      }
      // Opcional: si no se incluyen todos, solo reordenar los presentes y dejar el resto al final conservando su relativo
      // Aquí exigimos que coincidan en cardinalidad para un orden total:
      if (itemIds.length !== currentIds.length) {
        return next(new AppError(400,'Debe proporcionarse el conjunto completo de items del paquete','ITEM_IDS_INCOMPLETE'));
      }
      // Estrategia anti-colisión: mover temporalmente todas las posiciones lejos para evitar violar unique (package_id, position)
      // (dos fases dentro de la misma transacción)
      await client.query('UPDATE analysis_package_items SET position = position + 1000 WHERE package_id=$1', [pkgId]);
      // Construir VALUES para actualizar en bloque
      const values = itemIds.map((id, idx) => `('${id}'::uuid, ${idx+1})`).join(',');
      const upd = `
        UPDATE analysis_package_items AS i
        SET position = v.position
        FROM (VALUES ${values}) AS v(id, position)
        WHERE i.id = v.id AND i.package_id = $1
      `;
      const r = await client.query(upd, [pkgId]);
      await client.query('COMMIT');
      res.json({ updated: r.rowCount });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch(e){ console.error(e); next(new AppError(500,'Error reordenando items','PACKAGE_ITEMS_REORDER_FAIL')); }
});

router.delete('/items/:itemId', auth, requirePermission('packages','update'), audit('delete','package_item', req=>req.params.itemId), async (req,res,next)=>{ try { const { rowCount } = await activePool(req).query('DELETE FROM analysis_package_items WHERE id=$1',[req.params.itemId]); if(!rowCount) return next(new AppError(404,'Item no encontrado','PACKAGE_ITEM_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando item','PACKAGE_ITEM_DELETE_FAIL'));} });

router.put('/:id', auth, requirePermission('packages','update'), sanitizeBody(['name','description']), validate(packageUpdateSchema), audit('update','package', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{ const fields=['name','description','price']; const sets=[]; const vals=[]; fields.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); }}); if(!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS')); vals.push(req.params.id); try { const { rows } = await activePool(req).query(`UPDATE analysis_packages SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals); if(!rows[0]) return next(new AppError(404,'Paquete no encontrado','PACKAGE_NOT_FOUND')); res.json(rows[0]); } catch(e){ console.error(e); next(new AppError(500,'Error actualizando paquete','PACKAGE_UPDATE_FAIL'));} });

router.delete('/:id', auth, requirePermission('packages','delete'), audit('delete','package', req=>req.params.id), async (req,res,next)=>{ try { const { rowCount } = await activePool(req).query('DELETE FROM analysis_packages WHERE id=$1',[req.params.id]); if(!rowCount) return next(new AppError(404,'Paquete no encontrado','PACKAGE_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando paquete','PACKAGE_DELETE_FAIL'));} });

module.exports = router;
