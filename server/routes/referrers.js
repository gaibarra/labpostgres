const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { parsePagination, buildSearchFilter } = require('../utils/pagination');
const { AppError } = require('../utils/errors');

const router = express.Router();
const { validate } = require('../middleware/validate');
const { referrerCreateSchema, referrerUpdateSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');
const { sanitizeBody } = require('../middleware/sanitize');

router.get('/', auth, requirePermission('referrers','read'), async (req,res,next)=>{
  try {
    const { limit, offset } = parsePagination(req.query);
    const { clause, params } = buildSearchFilter(req.query.search,['name','entity_type','specialty','email']);
    let base='FROM referring_entities';
    if(clause) base+=' WHERE '+clause;
    const rowsQ=`SELECT * ${base} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    const cntQ=`SELECT COUNT(*)::int AS total ${base}`;
    const [r,c]=await Promise.all([
      pool.query(rowsQ.replace(/\$SEARCH/g,'$'),[...params,limit,offset]),
      pool.query(cntQ.replace(/\$SEARCH/g,'$'),params)
    ]);
    res.json({ data:r.rows, page:{ limit, offset, total:c.rows[0].total }});
  } catch(e){ console.error(e); next(new AppError(500,'Error listando referentes','REFERRER_LIST_FAIL')); }
});

router.post('/', auth, requirePermission('referrers','create'), sanitizeBody(['name','entity_type','specialty','email','phone_number','address']), validate(referrerCreateSchema), audit('create','referrer', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{
  const { name, entity_type, specialty, email, phone_number, address, listaprecios } = req.body || {};
  try {
    const { rows } = await pool.query(
      'INSERT INTO referring_entities(name, entity_type, specialty, email, phone_number, address, listaprecios) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name,entity_type||null,specialty||null,email||null,phone_number||null,address||null,listaprecios||null]
    );
    const created=rows[0]; res.locals.createdId = created.id; res.status(201).json(created);
  } catch(e){
    console.error(e);
    // duplicate name unique index
    if (e.code === '23505') return next(new AppError(409,'Ya existe un referente con ese nombre','REFERRER_DUPLICATE'));
    next(new AppError(500,'Error creando referente','REFERRER_CREATE_FAIL'));
  }
});

// Count endpoints (colocados antes de rutas con :id para evitar colisión)
router.get('/count', auth, requirePermission('referrers','read'), async (_req,res,next)=>{ try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM referring_entities'); res.json({ total: rows[0].total }); } catch(e){ console.error(e); next(new AppError(500,'Error contando referentes','REFERRER_COUNT_FAIL')); } });
router.get('/count/all', auth, requirePermission('referrers','read'), async (_req,res,next)=>{ try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM referring_entities'); res.json({ total: rows[0].total }); } catch(e){ console.error(e); next(new AppError(500,'Error contando referentes','REFERRER_COUNT_FAIL')); } });

// CRUD con :id (después de endpoints específicos)
router.get('/:id', auth, requirePermission('referrers','read'), async (req,res,next)=>{
  try {
    const { rows } = await pool.query('SELECT * FROM referring_entities WHERE id=$1',[req.params.id]);
    if(!rows[0]) return next(new AppError(404,'Referente no encontrado','REFERRER_NOT_FOUND'));
    res.json(rows[0]);
  } catch(e){ console.error(e); next(new AppError(500,'Error obteniendo referente','REFERRER_GET_FAIL')); }
});

router.put('/:id', auth, requirePermission('referrers','update'), sanitizeBody(['name','entity_type','specialty','email','phone_number','address']), validate(referrerUpdateSchema), audit('update','referrer', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{
  try {
    // Proteger el referente 'Particular' contra cambios de nombre/tipo/especialidad/contacto; permitir solo listaprecios
    const { rows: baseRows } = await pool.query('SELECT name FROM referring_entities WHERE id=$1',[req.params.id]);
    if (!baseRows[0]) return next(new AppError(404,'Referente no encontrado','REFERRER_NOT_FOUND'));
    const isParticular = baseRows[0].name && baseRows[0].name.toLowerCase() === 'particular';

    const fields=['name','entity_type','specialty','email','phone_number','address','listaprecios'];
    const sets=[]; const vals=[];
    fields.forEach(f=>{
      if(Object.prototype.hasOwnProperty.call(req.body,f)){
        if (isParticular && f !== 'listaprecios') return; // saltar campos protegidos
        sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]);
      }
    });
    if(!sets.length) return next(new AppError(400,'Nada para actualizar o campos protegidos','NO_UPDATE_FIELDS'));
    vals.push(req.params.id);
    const { rows } = await pool.query(`UPDATE referring_entities SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
    res.json(rows[0]);
  } catch(e){
    console.error(e);
    if (e.code === '23505') return next(new AppError(409,'Ya existe un referente con ese nombre','REFERRER_DUPLICATE'));
    next(new AppError(500,'Error actualizando referente','REFERRER_UPDATE_FAIL'));
  }
});

router.delete('/:id', auth, requirePermission('referrers','delete'), audit('delete','referrer', req=>req.params.id), async (req,res,next)=>{
  try {
    // Evitar eliminar 'Particular'
    const { rows: check } = await pool.query('SELECT name FROM referring_entities WHERE id=$1',[req.params.id]);
    if (!check[0]) return next(new AppError(404,'Referente no encontrado','REFERRER_NOT_FOUND'));
    if ((check[0].name||'').toLowerCase() === 'particular') return next(new AppError(400,"El referente 'Particular' no puede eliminarse",'REFERRER_PROTECTED'));

    // Bloquear eliminación si hay órdenes que referencian a este referente (como entidad o médico)
    try {
      const { rows: usedRows } = await pool.query(
        `SELECT (
           EXISTS(SELECT 1 FROM work_orders WHERE referring_entity_id = $1) OR
           EXISTS(SELECT 1 FROM work_orders WHERE referring_doctor_id = $1)
         ) AS in_use`,
        [req.params.id]
      );
      const inUse = usedRows && usedRows[0] && usedRows[0].in_use === true;
      if (inUse) return next(new AppError(409,'No se puede eliminar: el referente está asociado a órdenes','REFERRER_IN_USE'));
    } catch (inner) {
      // Si ocurre un error aquí, continuamos al intento de DELETE y se manejará en el catch principal
    }

    const { rowCount } = await pool.query('DELETE FROM referring_entities WHERE id=$1',[req.params.id]);
    if(!rowCount) return next(new AppError(404,'Referente no encontrado','REFERRER_NOT_FOUND'));
    res.status(204).send();
  } catch(e){ console.error(e); next(new AppError(500,'Error eliminando referente','REFERRER_DELETE_FAIL')); }
});

module.exports = router;
