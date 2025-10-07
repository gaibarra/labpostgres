const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { parsePagination, buildSearchFilter } = require('../utils/pagination');
const { AppError } = require('../utils/errors');

const router = express.Router();
const { validate } = require('../middleware/validate');
const { packageCreateSchema, packageUpdateSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');
const { sanitizeBody } = require('../middleware/sanitize');
function activePool(req){ return req.tenantPool || pool; }

router.get('/', auth, requirePermission('packages','read'), async (req,res,next)=>{ try {
  const { limit, offset } = parsePagination(req.query); const { clause, params } = buildSearchFilter(req.query.search,['name']); let base='FROM analysis_packages'; if(clause) base+=' WHERE '+clause; const rowsQ=`SELECT * ${base} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`; const cntQ=`SELECT COUNT(*)::int AS total ${base}`; const [r,c]=await Promise.all([activePool(req).query(rowsQ.replace(/\$SEARCH/g,'$'),[...params,limit,offset]), activePool(req).query(cntQ.replace(/\$SEARCH/g,'$'),params)]); res.json({ data:r.rows, page:{ limit, offset, total:c.rows[0].total }}); } catch(e){ console.error(e); next(new AppError(500,'Error listando paquetes','PACKAGE_LIST_FAIL'));} });

// Detailed packages including items aggregated
router.get('/detailed', auth, requirePermission('packages','read'), async (req,res,next)=>{
  try {
    const { limit, offset } = parsePagination(req.query);
    const { clause, params } = buildSearchFilter(req.query.search,['name']);
    const where = clause ? ` WHERE ${clause}` : '';
    // Detect if analysis_package_items table exists in tenant
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
              'name', CASE WHEN i.item_type='analysis' THEN a.name ELSE NULL END
            ) ORDER BY i.created_at
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
      // Fallback: return packages with empty items array
      const q2 = `SELECT * FROM analysis_packages${where} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
      const cntQ2 = `SELECT COUNT(*)::int AS total FROM analysis_packages${where}`;
      const [rowsR2, cntR2] = await Promise.all([
        activePool(req).query(q2, [...params, limit, offset]),
        activePool(req).query(cntQ2, params)
      ]);
      data = rowsR2.rows.map(p=>({ ...p, items: [] }));
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
    const { rows } = await activePool(req).query(`
      SELECT i.*, CASE WHEN i.item_type='analysis' THEN a.name ELSE NULL END AS name
      FROM analysis_package_items i
      LEFT JOIN analysis a ON a.id = i.item_id AND i.item_type='analysis'
      WHERE i.package_id = $1
      ORDER BY i.created_at
    `,[req.params.id]);
    const data = rows.map(r => ({ ...r, name: r.name || 'Item desconocido' }));
    res.json(data);
  } catch(e){ console.error(e); next(new AppError(500,'Error listando items','PACKAGE_ITEMS_LIST_FAIL')); }
});

router.post('/:id/items', auth, requirePermission('packages','update'), audit('create','package_item', (req,r)=>r.locals?.pkgItemId, (req)=>({ body: req.body, package_id: req.params.id })), async (req,res,next)=>{ const { item_id, item_type } = req.body || {}; if(!item_id) return next(new AppError(400,'item_id requerido','ITEM_ID_REQUIRED')); try { const { rows } = await activePool(req).query('INSERT INTO analysis_package_items(package_id,item_id,item_type) VALUES($1,$2,$3) RETURNING *',[req.params.id,item_id,item_type||'analysis']); const created=rows[0]; res.locals.pkgItemId = created.id; res.status(201).json(created); } catch(e){ console.error(e); next(new AppError(500,'Error agregando item','PACKAGE_ITEM_ADD_FAIL'));} });

router.delete('/items/:itemId', auth, requirePermission('packages','update'), audit('delete','package_item', req=>req.params.itemId), async (req,res,next)=>{ try { const { rowCount } = await activePool(req).query('DELETE FROM analysis_package_items WHERE id=$1',[req.params.itemId]); if(!rowCount) return next(new AppError(404,'Item no encontrado','PACKAGE_ITEM_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando item','PACKAGE_ITEM_DELETE_FAIL'));} });

router.put('/:id', auth, requirePermission('packages','update'), sanitizeBody(['name','description']), validate(packageUpdateSchema), audit('update','package', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{ const fields=['name','description','price']; const sets=[]; const vals=[]; fields.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); }}); if(!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS')); vals.push(req.params.id); try { const { rows } = await activePool(req).query(`UPDATE analysis_packages SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals); if(!rows[0]) return next(new AppError(404,'Paquete no encontrado','PACKAGE_NOT_FOUND')); res.json(rows[0]); } catch(e){ console.error(e); next(new AppError(500,'Error actualizando paquete','PACKAGE_UPDATE_FAIL'));} });

router.delete('/:id', auth, requirePermission('packages','delete'), audit('delete','package', req=>req.params.id), async (req,res,next)=>{ try { const { rowCount } = await activePool(req).query('DELETE FROM analysis_packages WHERE id=$1',[req.params.id]); if(!rowCount) return next(new AppError(404,'Paquete no encontrado','PACKAGE_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando paquete','PACKAGE_DELETE_FAIL'));} });

module.exports = router;
