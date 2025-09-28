const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { requirePermission } = require('../middleware/permissions');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();
const { validate } = require('../middleware/validate');
const { createPatientSchema, updatePatientSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');

const { normalizeCivilDateFields, normalizeCivilDate } = require('../utils/dates');

// List patients (basic). TODO: add pagination & filters
router.get('/', auth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM patients ORDER BY created_at DESC LIMIT 200');
  res.json(rows.map(r=>normalizeCivilDateFields(r)));
  } catch (e) { console.error(e); next(new AppError(500,'Error listando pacientes','PATIENT_LIST_FAIL')); }
});

// Simple count endpoint for dashboard efficiency (keep /count and /count/all for compatibility)
router.get('/count', auth, requirePermission('patients','read'), async (_req,res,next)=>{
  try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM patients'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando pacientes','PATIENT_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('patients','read'), async (_req,res,next)=>{
  try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM patients'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando pacientes','PATIENT_COUNT_FAIL')); }
});

router.post('/', auth, sanitizeBody(['full_name','email','phone_number']), validate(createPatientSchema), audit('create','patient', (req,r)=>r.locals?.createdId, (req,r)=>({ body: req.body })), async (req, res, next) => {
  let { full_name, date_of_birth, sex, email, phone_number, address, contact_name, contact_phone, clinical_history } = req.body || {};
  if (typeof date_of_birth === 'string') date_of_birth = normalizeCivilDate(date_of_birth);
  if (!full_name) return next(new AppError(400,'full_name requerido','FULL_NAME_REQUIRED'));
  try {
    const { rows } = await pool.query(`
      INSERT INTO patients(full_name, date_of_birth, sex, email, phone_number, address, contact_name, contact_phone, clinical_history)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [full_name, date_of_birth || null, sex || null, email || null, phone_number || null, address || null, contact_name || null, contact_phone || null, clinical_history || null]);
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(normalizeCivilDateFields(created));
  } catch (e) {
    // Mapear errores de fecha inválida de Postgres (invalid datetime format / date out of range)
    if (e && e.code && (e.code === '22007' || e.code === '22008')) {
      return next(new AppError(400,'Fecha inválida','INVALID_DATE'));
    }
    console.error(e);
    next(new AppError(500,'Error creando paciente','PATIENT_CREATE_FAIL'));
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM patients WHERE id=$1', [req.params.id]);
  if (!rows[0]) return next(new AppError(404,'Paciente no encontrado','PATIENT_NOT_FOUND'));
  res.json(normalizeCivilDateFields(rows[0]));
  } catch (e) { console.error(e); next(new AppError(500,'Error obteniendo paciente','PATIENT_GET_FAIL')); }
});

router.put('/:id', auth, sanitizeBody(['full_name','email','phone_number']), validate(updatePatientSchema), audit('update','patient', req=>req.params.id, (req)=>({ body: req.body })), async (req, res, next) => {
  const permitted = ['full_name','date_of_birth','sex','email','phone_number','address','contact_name','contact_phone','clinical_history'];
  const updates = [];
  const values = [];
  permitted.forEach(f => {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      let v = req.body[f];
      if (f === 'date_of_birth' && typeof v === 'string') v = normalizeCivilDate(v);
      updates.push(`${f}=$${updates.length + 1}`);
      values.push(v === '' ? null : v);
    }
  });
  if (!updates.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE patients SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`, values);
    if (!rows[0]) return next(new AppError(404,'Paciente no encontrado','PATIENT_NOT_FOUND'));
    res.json(normalizeCivilDateFields(rows[0]));
  } catch (e) {
    if (e && e.code && (e.code === '22007' || e.code === '22008')) {
      return next(new AppError(400,'Fecha inválida','INVALID_DATE'));
    }
    console.error(e);
    next(new AppError(500,'Error actualizando paciente','PATIENT_UPDATE_FAIL'));
  }
});

router.delete('/:id', auth, audit('delete','patient', req=>req.params.id), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM patients WHERE id=$1', [req.params.id]);
    if (!rowCount) return next(new AppError(404,'Paciente no encontrado','PATIENT_NOT_FOUND'));
    res.status(204).send();
  } catch (e) { console.error(e); next(new AppError(500,'Error eliminando paciente','PATIENT_DELETE_FAIL')); }
});

module.exports = router;
