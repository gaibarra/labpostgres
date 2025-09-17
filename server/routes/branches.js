const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
const { audit } = require('../middleware/audit');

const router = express.Router();

async function ensureBranchColumns(){
  try {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='branches'`);
    const cols = rows.map(r=>r.column_name);
    const add = [];
    const want = {
      city: 'text', state: 'text', zip_code: 'text', country: 'text', phone: 'text', email: 'text', manager_name: 'text', operating_hours: 'text', folio_prefix: 'text', is_main: 'boolean DEFAULT false'
    };
    for (const [k,v] of Object.entries(want)) if(!cols.includes(k)) add.push(`ADD COLUMN ${k} ${v}`);
    if (add.length) await pool.query('ALTER TABLE branches ' + add.join(', '));
  } catch(e){ console.error('Error ensuring branches columns', e); }
}
ensureBranchColumns();

router.get('/', auth, requirePermission('administration','manage_branches'), async (_req,res,next)=>{
  try { const { rows } = await pool.query('SELECT * FROM branches ORDER BY created_at DESC'); res.json(rows); } catch(e){ console.error(e); next(new AppError(500,'Error listando sucursales','BRANCH_LIST_FAIL')); }
});

router.post('/seed-default', auth, requirePermission('administration','manage_branches'), async (req,res,next)=>{
  const b = req.body || {};
  try {
    const { rows } = await pool.query('INSERT INTO branches(name,address,city,state,zip_code,country,phone,email,manager_name,operating_hours,folio_prefix,is_active,is_main) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,true),COALESCE($13,true)) RETURNING *', [b.name||'Laboratorio Matriz', b.address||null, b.city||null, b.state||null, b.zip_code||null, b.country||null, b.phone||null, b.email||null, b.manager_name||null, b.operating_hours||null, b.folio_prefix||null, b.is_active, b.is_main]);
    res.status(201).json(rows[0]);
  } catch(e){ console.error(e); next(new AppError(500,'Error creando sucursal por defecto','BRANCH_SEED_FAIL')); }
});

router.post('/', auth, requirePermission('administration','manage_branches'), audit('create','branch', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{
  const f = req.body || {};
  if(!f.name) return next(new AppError(400,'name requerido','BRANCH_NAME_REQ'));
  try {
    const { rows } = await pool.query('INSERT INTO branches(name,address,city,state,zip_code,country,phone,email,manager_name,operating_hours,folio_prefix,is_active,is_main) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,true),COALESCE($13,false)) RETURNING *', [f.name,f.address||null,f.city||null,f.state||null,f.zip_code||null,f.country||null,f.phone||null,f.email||null,f.manager_name||null,f.operating_hours||null,f.folio_prefix||null,f.is_active,f.is_main]);
    res.locals.createdId = rows[0].id;
    res.status(201).json(rows[0]);
  } catch(e){ console.error(e); next(new AppError(500,'Error creando sucursal','BRANCH_CREATE_FAIL')); }
});

router.put('/:id', auth, requirePermission('administration','manage_branches'), audit('update','branch', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{
  const allowed = ['name','address','city','state','zip_code','country','phone','email','manager_name','operating_hours','folio_prefix','is_active','is_main'];
  const sets=[]; const vals=[];
  allowed.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); }});
  if(!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
  vals.push(req.params.id);
  try { const { rows } = await pool.query(`UPDATE branches SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals); if(!rows[0]) return next(new AppError(404,'Sucursal no encontrada','BRANCH_NOT_FOUND')); res.json(rows[0]); } catch(e){ console.error(e); next(new AppError(500,'Error actualizando sucursal','BRANCH_UPDATE_FAIL')); }
});

router.patch('/:id', auth, requirePermission('administration','manage_branches'), audit('update','branch', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{
  const allowed = ['is_active','name','manager_name'];
  const sets=[]; const vals=[];
  allowed.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); }});
  if(!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
  vals.push(req.params.id);
  try { const { rows } = await pool.query(`UPDATE branches SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals); if(!rows[0]) return next(new AppError(404,'Sucursal no encontrada','BRANCH_NOT_FOUND')); res.json(rows[0]); } catch(e){ console.error(e); next(new AppError(500,'Error actualizando sucursal','BRANCH_UPDATE_FAIL')); }
});

router.delete('/:id', auth, requirePermission('administration','manage_branches'), audit('delete','branch', req=>req.params.id), async (req,res,next)=>{
  try { const { rowCount } = await pool.query('DELETE FROM branches WHERE id=$1',[req.params.id]); if(!rowCount) return next(new AppError(404,'Sucursal no encontrada','BRANCH_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando sucursal','BRANCH_DELETE_FAIL')); }
});

module.exports = router;
