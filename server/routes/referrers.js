const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { parsePagination, buildSearchFilter } = require('../utils/pagination');
const { AppError } = require('../utils/errors');
const { validate } = require('../middleware/validate');
const { referrerCreateSchema, referrerUpdateSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();
const TABLE = 'referring_entities';
function activePool(req){ return req.tenantPool || pool; }

// LIST
router.get('/', auth, requirePermission('referrers','read'), async (req,res,next)=>{
  try {
    const { limit, offset } = parsePagination(req.query);
    const { clause, params } = buildSearchFilter(req.query.search,['name','entity_type','specialty','email']);
    let base='FROM '+TABLE;
    if (clause) base += ' WHERE '+clause;
    const rowsQ = `SELECT * ${base} ORDER BY (LOWER(name)='particular') DESC, created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    const cntQ  = `SELECT COUNT(*)::int AS total ${base}`;
    const [r,c] = await Promise.all([
      activePool(req).query(rowsQ,[...params,limit,offset]),
      activePool(req).query(cntQ,params)
    ]);
    res.json({ data: r.rows, page:{ limit, offset, total: c.rows[0].total }});
  } catch(e){ console.error('[REFERRER_LIST_FAIL]', e); next(new AppError(500,'Error listando referentes','REFERRER_LIST_FAIL')); }
});

// COUNTS (colocar antes de rutas paramétricas para evitar captura por /:id)
router.get('/count', auth, requirePermission('referrers','read'), async (req,res,next)=>{
  try {
    const { rows } = await activePool(req).query(`SELECT COUNT(*)::int AS total FROM ${TABLE}`);
    res.json({ total: rows[0].total });
  } catch(e){ console.error('[REFERRER_COUNT_FAIL]', e); next(new AppError(500,'Error contando referentes','REFERRER_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('referrers','read'), async (req,res,next)=>{
  try {
    const { rows } = await activePool(req).query(`SELECT COUNT(*)::int AS total FROM ${TABLE}`);
    res.json({ total: rows[0].total });
  } catch(e){ console.error('[REFERRER_COUNT_FAIL]', e); next(new AppError(500,'Error contando referentes','REFERRER_COUNT_FAIL')); }
});

// CREATE
router.post('/', auth, requirePermission('referrers','create'), sanitizeBody(['name','entity_type','specialty','email','phone_number','address','listaprecios']), validate(referrerCreateSchema), audit('create','referrer', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{
  const { name, entity_type, specialty, email, phone_number, address, listaprecios } = req.body || {};
  try {
    const { rows } = await activePool(req).query(
      `INSERT INTO ${TABLE}(name, entity_type, specialty, email, phone_number, address, listaprecios) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, entity_type||null, specialty||null, email||null, phone_number||null, address||null, listaprecios||null]
    );
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch(e){
    console.error('[REFERRER_CREATE_FAIL]', e);
    if (e.code === '23505') return next(new AppError(409,'Ya existe un referente con ese nombre','REFERRER_DUPLICATE'));
    next(new AppError(500,'Error creando referente','REFERRER_CREATE_FAIL'));
  }
});
// READ ONE
router.get('/:id', auth, requirePermission('referrers','read'), async (req,res,next)=>{
  try {
    const { rows } = await activePool(req).query(`SELECT * FROM ${TABLE} WHERE id=$1`,[req.params.id]);
    if(!rows[0]) return next(new AppError(404,'Referente no encontrado','REFERRER_NOT_FOUND'));
    res.json(rows[0]);
  } catch(e){ console.error('[REFERRER_GET_FAIL]', e); next(new AppError(500,'Error obteniendo referente','REFERRER_GET_FAIL')); }
});

// UPDATE
router.put('/:id', auth, requirePermission('referrers','update'), sanitizeBody(['name','entity_type','specialty','email','phone_number','address','listaprecios']), validate(referrerUpdateSchema), audit('update','referrer', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{
  try {
    const { rows: baseRows } = await activePool(req).query(`SELECT name FROM ${TABLE} WHERE id=$1`,[req.params.id]);
    if(!baseRows[0]) return next(new AppError(404,'Referente no encontrado','REFERRER_NOT_FOUND'));
    const isParticular = (baseRows[0].name||'').toLowerCase()==='particular';
    const allowed = ['name','entity_type','specialty','email','phone_number','address','listaprecios'];
    const sets=[]; const vals=[];
    allowed.forEach(f=>{
      if(Object.prototype.hasOwnProperty.call(req.body,f)){
        if (isParticular && f!=='listaprecios') return; // proteger
        sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]);
      }
    });
    if(!sets.length) return next(new AppError(400,'Nada para actualizar o campos protegidos','NO_UPDATE_FIELDS'));
    vals.push(req.params.id);
    const { rows } = await activePool(req).query(`UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
    res.json(rows[0]);
  } catch(e){
    console.error('[REFERRER_UPDATE_FAIL]', e);
    if (e.code === '23505') return next(new AppError(409,'Ya existe un referente con ese nombre','REFERRER_DUPLICATE'));
    next(new AppError(500,'Error actualizando referente','REFERRER_UPDATE_FAIL'));
  }
});

// DELETE
router.delete('/:id', auth, requirePermission('referrers','delete'), audit('delete','referrer', req=>req.params.id), async (req,res,next)=>{
  try {
    const { rows: check } = await activePool(req).query(`SELECT name FROM ${TABLE} WHERE id=$1`,[req.params.id]);
    if (!check[0]) return next(new AppError(404,'Referente no encontrado','REFERRER_NOT_FOUND'));
    if ((check[0].name||'').toLowerCase()==='particular') return next(new AppError(400,"El referente 'Particular' no puede eliminarse","REFERRER_PROTECTED"));
    // Protección: si existen work_orders que referencian a este referente devolver 409
    try {
      const refQ = await activePool(req).query('SELECT 1 FROM work_orders WHERE referring_entity_id=$1 LIMIT 1',[req.params.id]);
  if (refQ.rows[0]) return next(new AppError(409,'Referente referenciado por órdenes','REFERRER_IN_USE'));
    } catch(dbCheckErr){ console.warn('[REFERRER_DELETE_REF_CHECK_FAIL]', dbCheckErr.message); }
    const { rowCount } = await activePool(req).query(`DELETE FROM ${TABLE} WHERE id=$1`,[req.params.id]);
    if(!rowCount) return next(new AppError(404,'Referente no encontrado','REFERRER_NOT_FOUND'));
    res.status(204).send();
  } catch(e){ console.error('[REFERRER_DELETE_FAIL]', e); next(new AppError(500,'Error eliminando referente','REFERRER_DELETE_FAIL')); }
});

module.exports = router;
