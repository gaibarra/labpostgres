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

router.get('/', auth, requirePermission('packages','read'), async (req,res,next)=>{ try { const { limit, offset } = parsePagination(req.query); const { clause, params } = buildSearchFilter(req.query.search,['name']); let base='FROM analysis_packages'; if(clause) base+=' WHERE '+clause; const rowsQ=`SELECT * ${base} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`; const cntQ=`SELECT COUNT(*)::int AS total ${base}`; const [r,c]=await Promise.all([pool.query(rowsQ.replace(/\$SEARCH/g,'$'),[...params,limit,offset]), pool.query(cntQ.replace(/\$SEARCH/g,'$'),params)]); res.json({ data:r.rows, page:{ limit, offset, total:c.rows[0].total }}); } catch(e){ console.error(e); next(new AppError(500,'Error listando paquetes','PACKAGE_LIST_FAIL'));} });

// Detailed packages including items aggregated
router.get('/detailed', auth, requirePermission('packages','read'), async (req,res,next)=>{
	try {
		const { limit, offset } = parsePagination(req.query);
		const { clause, params } = buildSearchFilter(req.query.search,['name']);
		let where = clause ? ` WHERE ${clause}` : '';
		const q = `
			SELECT p.*, COALESCE(items.items,'[]') AS items
			FROM analysis_packages p
			LEFT JOIN LATERAL (
				SELECT json_agg(json_build_object('id', i.id,'item_id', i.item_id,'item_type', i.item_type) ORDER BY i.created_at) AS items
				FROM analysis_package_items i WHERE i.package_id = p.id
			) items ON true
			${where}
			ORDER BY p.created_at DESC
			LIMIT $${params.length+1} OFFSET $${params.length+2}
		`;
		const cntQ = `SELECT COUNT(*)::int AS total FROM analysis_packages${where}`;
		const [rowsR, cntR] = await Promise.all([
			pool.query(q, [...params, limit, offset]),
			pool.query(cntQ, params)
		]);
		res.json({ data: rowsR.rows, page: { limit, offset, total: cntR.rows[0].total } });
	} catch(e){ console.error(e); next(new AppError(500,'Error listando paquetes detallados','PACKAGE_DETAILED_LIST_FAIL')); }
});

router.get('/count', auth, requirePermission('packages','read'), async (_req,res,next)=>{
	try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM analysis_packages'); res.json({ total: rows[0].total }); }
	catch(e){ console.error(e); next(new AppError(500,'Error contando paquetes','PACKAGE_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('packages','read'), async (_req,res,next)=>{
	try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM analysis_packages'); res.json({ total: rows[0].total }); }
	catch(e){ console.error(e); next(new AppError(500,'Error contando paquetes','PACKAGE_COUNT_FAIL')); }
});

router.post('/', auth, requirePermission('packages','create'), sanitizeBody(['name','description']), validate(packageCreateSchema), audit('create','package', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{ const { name, description, price } = req.body || {}; try { const { rows } = await pool.query('INSERT INTO analysis_packages(name, description, price) VALUES($1,$2,$3) RETURNING *',[name,description||null,price||null]); const created=rows[0]; res.locals.createdId = created.id; res.status(201).json(created); } catch(e){ console.error(e); next(new AppError(500,'Error creando paquete','PACKAGE_CREATE_FAIL'));} });

router.get('/:id/items', auth, requirePermission('packages','read'), async (req,res,next)=>{ try { const { rows } = await pool.query('SELECT * FROM analysis_package_items WHERE package_id=$1',[req.params.id]); res.json(rows); } catch(e){ console.error(e); next(new AppError(500,'Error listando items','PACKAGE_ITEMS_LIST_FAIL'));} });

router.post('/:id/items', auth, requirePermission('packages','update'), audit('create','package_item', (req,r)=>r.locals?.pkgItemId, (req)=>({ body: req.body, package_id: req.params.id })), async (req,res,next)=>{ const { item_id, item_type } = req.body || {}; if(!item_id) return next(new AppError(400,'item_id requerido','ITEM_ID_REQUIRED')); try { const { rows } = await pool.query('INSERT INTO analysis_package_items(package_id,item_id,item_type) VALUES($1,$2,$3) RETURNING *',[req.params.id,item_id,item_type||'analysis']); const created=rows[0]; res.locals.pkgItemId = created.id; res.status(201).json(created); } catch(e){ console.error(e); next(new AppError(500,'Error agregando item','PACKAGE_ITEM_ADD_FAIL'));} });

router.delete('/items/:itemId', auth, requirePermission('packages','update'), audit('delete','package_item', req=>req.params.itemId), async (req,res,next)=>{ try { const { rowCount } = await pool.query('DELETE FROM analysis_package_items WHERE id=$1',[req.params.itemId]); if(!rowCount) return next(new AppError(404,'Item no encontrado','PACKAGE_ITEM_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando item','PACKAGE_ITEM_DELETE_FAIL'));} });

router.put('/:id', auth, requirePermission('packages','update'), sanitizeBody(['name','description']), validate(packageUpdateSchema), audit('update','package', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{ const fields=['name','description','price']; const sets=[]; const vals=[]; fields.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); }}); if(!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS')); vals.push(req.params.id); try { const { rows } = await pool.query(`UPDATE analysis_packages SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals); if(!rows[0]) return next(new AppError(404,'Paquete no encontrado','PACKAGE_NOT_FOUND')); res.json(rows[0]); } catch(e){ console.error(e); next(new AppError(500,'Error actualizando paquete','PACKAGE_UPDATE_FAIL'));} });

router.delete('/:id', auth, requirePermission('packages','delete'), audit('delete','package', req=>req.params.id), async (req,res,next)=>{ try { const { rowCount } = await pool.query('DELETE FROM analysis_packages WHERE id=$1',[req.params.id]); if(!rowCount) return next(new AppError(404,'Paquete no encontrado','PACKAGE_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando paquete','PACKAGE_DELETE_FAIL'));} });

module.exports = router;
