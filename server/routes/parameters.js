const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
const { ensureSystemParametersStore } = require('../services/schemaGuards');
const router = express.Router();

// Simple system parameters key/value store
// Table expected: system_parameters(id uuid pk default, name text unique not null, value text, created_at timestamptz default now(), updated_at timestamptz default now())

router.use((req, _res, next) => {
  ensureSystemParametersStore()
    .then(() => next())
    .catch(err => {
      console.error('[PARAMETERS] ensure store failed', err.message || err);
      next(new AppError(500, 'Error preparando almacenamiento de parámetros', 'PARAMETERS_SCHEMA_FAIL'));
    });
});

router.get('/', requireAuth, requirePermission('settings','view'), async (_req,res,next)=>{
  try {
    const { rows } = await pool.query('SELECT * FROM system_parameters ORDER BY name ASC');
    res.json(rows);
  } catch(e){
    console.error('[PARAMETERS] list failed', e);
    next(new AppError(500,'Error listando parámetros','PARAMETERS_LIST_FAIL'));
  }
});

router.post('/', requireAuth, requirePermission('settings','update'), async (req,res,next)=>{
  const { name, value } = req.body || {};
  if (!name) return next(new AppError(400,'name requerido','PARAMETER_VALIDATION'));
  try {
    const { rows } = await pool.query('INSERT INTO system_parameters(name,value) VALUES ($1,$2) RETURNING *',[name,value||null]);
    res.status(201).json(rows[0]);
  } catch(e){
    console.error('[PARAMETERS] create failed', e);
    if (e.code === '23505') return next(new AppError(409,'Parámetro ya existe','PARAMETER_DUPLICATE'));
    next(new AppError(500,'Error creando parámetro','PARAMETER_CREATE_FAIL'));
  }
});

router.put('/:id', requireAuth, requirePermission('settings','update'), async (req,res,next)=>{
  const { id } = req.params; const { name, value } = req.body || {};
  try {
    const { rows } = await pool.query('UPDATE system_parameters SET name = COALESCE($2,name), value = $3, updated_at = now() WHERE id = $1 RETURNING *',[id,name,value||null]);
    if (!rows[0]) return next(new AppError(404,'Parámetro no encontrado','PARAMETER_NOT_FOUND'));
    res.json(rows[0]);
  } catch(e){
    console.error('[PARAMETERS] update failed', e);
    if (e.code === '23505') return next(new AppError(409,'Nombre duplicado','PARAMETER_DUPLICATE'));
    next(new AppError(500,'Error actualizando parámetro','PARAMETER_UPDATE_FAIL'));
  }
});

router.delete('/:id', requireAuth, requirePermission('settings','update'), async (req,res,next)=>{
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM system_parameters WHERE id=$1',[id]);
    if (rowCount === 0) return next(new AppError(404,'Parámetro no encontrado','PARAMETER_NOT_FOUND'));
    res.json({ success: true });
  } catch(e){
    console.error('[PARAMETERS] delete failed', e);
    next(new AppError(500,'Error eliminando parámetro','PARAMETER_DELETE_FAIL'));
  }
});

module.exports = router;
