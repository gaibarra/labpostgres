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

// Helper para elegir el pool activo (tenant si existe)
function activePool(req){ return req.tenantPool || pool; }

// Column introspection metadata cache (per tenant pool) usando WeakMap para no filtrar memoria
// Guarda: { columns: Set<string>, generated: Set<string> }
const patientColsMetaCache = new WeakMap();
async function getPatientColsMeta(req){
  const poolRef = activePool(req);
  let cached = patientColsMetaCache.get(poolRef);
  if(!cached){
    try {
      const { rows } = await poolRef.query(`
        SELECT column_name, is_generated
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='patients'
      `);
      const cols = new Set();
      const generated = new Set();
      for(const r of rows){
        cols.add(r.column_name);
        if (r.is_generated === 'ALWAYS') generated.add(r.column_name);
      }
      cached = { columns: cols, generated };
    } catch(e) {
      console.warn('[patients] introspection failed', e.code||e.message);
      // Fallback conservador (asumimos que ninguna es generada para no ocultar updates legítimos)
      cached = { columns: new Set(['id','full_name','date_of_birth','sex','email','phone','created_at']), generated: new Set() };
    }
    patientColsMetaCache.set(poolRef, cached);
  }
  return cached;
}
// Compat wrapper para código existente que sólo necesita listado
async function getPatientCols(req){ return (await getPatientColsMeta(req)).columns; }
function invalidatePatientCols(req){ try { patientColsMetaCache.delete(activePool(req)); } catch(_){} }
function projectPatient(row){
  return normalizeCivilDateFields({
    ...row,
    // eliminar categoría histórica 'O'
    sex: row.sex === 'O' ? null : row.sex,
    phone_number: row.phone || row.phone_number || null,
    address: row.address || null,
    contact_name: row.contact_name || null,
    contact_phone: row.contact_phone || null,
    clinical_history: row.clinical_history || null
  });
}

function splitFullName(name){
  if(!name) return { first_name: null, last_name: null };
  const parts = String(name).trim().split(/\s+/);
  if(parts.length === 1) return { first_name: parts[0], last_name: null };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts.slice(-1).join(' ') };
}

function normalizeSex(v){
  if(!v) return null;
  const s = String(v).trim().toLowerCase();
  if(['m','masculino','male','hombre'].includes(s)) return 'M';
  if(['f','femenino','female','mujer'].includes(s)) return 'F';
  // 'o','otro','other' y cualquier otro valor -> null
  return null;
}
// List patients (basic). TODO: add pagination & filters
router.get('/', auth, async (req, res, next) => {
  try {
    const cols = await getPatientCols(req);
    const select = Array.from(cols).map(c=>c).join(', ');
    const { rows } = await activePool(req).query(`SELECT ${select} FROM patients ORDER BY created_at DESC LIMIT 200`);
    res.json(rows.map(projectPatient));
  } catch (e) { console.error('[PATIENT_LIST_FAIL]', e); next(new AppError(500,'Error listando pacientes','PATIENT_LIST_FAIL')); }
});

// Simple count endpoint for dashboard efficiency (keep /count and /count/all for compatibility)
router.get('/count', auth, requirePermission('patients','read'), async (req,res,next)=>{
  try { const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS total FROM patients'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando pacientes','PATIENT_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('patients','read'), async (req,res,next)=>{
  try { const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS total FROM patients'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando pacientes','PATIENT_COUNT_FAIL')); }
});

// Schema introspection endpoint (debug) - lista columnas detectadas para este tenant
router.get('/schema', auth, requirePermission('patients','read'), async (req,res,next)=>{
  try {
    const meta = await getPatientColsMeta(req);
    const columns = Array.from(meta.columns).sort();
    const generated = Array.from(meta.generated).sort();
    res.json({ columns, generated });
  } catch(e){
    console.error('[PATIENT_SCHEMA_FAIL]', e);
    next(new AppError(500,'Error obteniendo schema de pacientes','PATIENT_SCHEMA_FAIL'));
  }
});

router.post('/', auth, sanitizeBody(['full_name','email','phone_number']), validate(createPatientSchema), audit('create','patient', (req,r)=>r.locals?.createdId, (req,r)=>({ body: req.body })), async (req, res, next) => {
  let { full_name, date_of_birth, sex, email, phone_number, address, contact_name, contact_phone, clinical_history } = req.body || {};
  if (typeof date_of_birth === 'string') date_of_birth = normalizeCivilDate(date_of_birth);
  sex = normalizeSex(sex);
  if (!full_name) return next(new AppError(400,'full_name requerido','FULL_NAME_REQUIRED'));
  try {
    const meta = await getPatientColsMeta(req);
    const cols = meta.columns;
    const insertable = {};
    // Insertar full_name sólo si existe y no es generada
    if (cols.has('full_name') && !meta.generated.has('full_name')) insertable.full_name = full_name;
    // Compatibilidad con esquemas que separan first_name / last_name
    const { first_name, last_name } = splitFullName(full_name);
    if (cols.has('first_name')) insertable.first_name = first_name;
    if (cols.has('last_name')) insertable.last_name = last_name;
    if (cols.has('date_of_birth')) insertable.date_of_birth = date_of_birth || null;
    if (cols.has('sex')) insertable.sex = sex || null;
  if (cols.has('email')) insertable.email = email || null;
  // soportar ambos nombres de columna para teléfono
  if (cols.has('phone')) insertable.phone = phone_number || null;
  if (cols.has('phone_number')) insertable.phone_number = phone_number || null;
  if (cols.has('address')) insertable.address = address || null;
  if (cols.has('contact_name')) insertable.contact_name = contact_name || null;
  if (cols.has('contact_phone')) insertable.contact_phone = contact_phone || null;
  if (cols.has('clinical_history')) insertable.clinical_history = clinical_history || null;
    const names = Object.keys(insertable);
    const values = names.map((k)=>insertable[k]);
    if(!names.length) return next(new AppError(500,'Esquema patients sin columnas utilizables','PATIENT_SCHEMA_INVALID'));
    const placeholders = names.map((_,i)=>`$${i+1}`);
    const sql = `INSERT INTO patients(${names.join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`;
    const { rows } = await activePool(req).query(sql, values);
    const created = projectPatient(rows[0]);
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch (e) {
    if (e && e.code && (e.code === '22007' || e.code === '22008')) {
      return next(new AppError(400,'Fecha inválida','INVALID_DATE'));
    }
    console.error('[PATIENT_CREATE_FAIL]', e);
    next(new AppError(500,'Error creando paciente','PATIENT_CREATE_FAIL'));
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const { rows } = await activePool(req).query('SELECT * FROM patients WHERE id=$1', [req.params.id]);
    if (!rows[0]) return next(new AppError(404,'Paciente no encontrado','PATIENT_NOT_FOUND'));
    res.json(projectPatient(rows[0]));
  } catch (e) { console.error('[PATIENT_GET_FAIL]', e); next(new AppError(500,'Error obteniendo paciente','PATIENT_GET_FAIL')); }
});

router.put('/:id', auth, sanitizeBody(['full_name','email','phone_number']), validate(updatePatientSchema), audit('update','patient', req=>req.params.id, (req)=>({ body: req.body })), async (req, res, next) => {
  let retriedSchema = false; // para 42703
  let retriedGenerated = false; // para 428C9
  for(;;){
    let meta, cols, updates = [], values = [];
    try {
      meta = await getPatientColsMeta(req);
      cols = meta.columns;
      if(Object.prototype.hasOwnProperty.call(req.body,'full_name')){
        const { first_name, last_name } = splitFullName(req.body.full_name);
        if(cols.has('full_name') && !meta.generated.has('full_name')) { updates.push(`full_name=$${values.length+1}`); values.push(req.body.full_name); }
        if(cols.has('first_name')) { updates.push(`first_name=$${values.length+1}`); values.push(first_name); }
        if(cols.has('last_name')) { updates.push(`last_name=$${values.length+1}`); values.push(last_name); }
      }
      if(Object.prototype.hasOwnProperty.call(req.body,'date_of_birth') && cols.has('date_of_birth')){
        let v = req.body.date_of_birth; if(typeof v==='string') v = normalizeCivilDate(v); updates.push(`date_of_birth=$${values.length+1}`); values.push(v||null);
      }
      if(Object.prototype.hasOwnProperty.call(req.body,'sex') && cols.has('sex')){ updates.push(`sex=$${values.length+1}`); values.push(normalizeSex(req.body.sex)||null); }
      if(Object.prototype.hasOwnProperty.call(req.body,'email') && cols.has('email')){ updates.push(`email=$${values.length+1}`); values.push(req.body.email||null); }
      if(Object.prototype.hasOwnProperty.call(req.body,'phone_number')){
        if (cols.has('phone')) { updates.push(`phone=$${values.length+1}`); values.push(req.body.phone_number||null); }
        else if (cols.has('phone_number')) { updates.push(`phone_number=$${values.length+1}`); values.push(req.body.phone_number||null); }
      }
  if(Object.prototype.hasOwnProperty.call(req.body,'address') && cols.has('address')){ updates.push(`address=$${values.length+1}`); values.push(req.body.address||null); }
  if(Object.prototype.hasOwnProperty.call(req.body,'contact_name') && cols.has('contact_name')){ updates.push(`contact_name=$${values.length+1}`); values.push(req.body.contact_name||null); }
  if(Object.prototype.hasOwnProperty.call(req.body,'contact_phone') && cols.has('contact_phone')){ updates.push(`contact_phone=$${values.length+1}`); values.push(req.body.contact_phone||null); }
  if(Object.prototype.hasOwnProperty.call(req.body,'clinical_history') && cols.has('clinical_history')){ updates.push(`clinical_history=$${values.length+1}`); values.push(req.body.clinical_history||null); }
      if(!updates.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
      values.push(req.params.id);
      const { rows } = await activePool(req).query(`UPDATE patients SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`, values);
      if(!rows[0]) return next(new AppError(404,'Paciente no encontrado','PATIENT_NOT_FOUND'));
      return res.json(projectPatient(rows[0]));
    } catch(e){
      if (e && e.code && (e.code === '22007' || e.code === '22008')) return next(new AppError(400,'Fecha inválida','INVALID_DATE'));
      if (e && e.code === '42703' && !retriedSchema) { retriedSchema = true; invalidatePatientCols(req); continue; }
      // 428C9: intento de actualizar columna generada (ej: full_name). Marcarla y reintentar una vez.
      if (e && e.code === '428C9' && !retriedGenerated) {
        retriedGenerated = true;
        try {
          const metaNow = await getPatientColsMeta(req);
          metaNow.generated.add('full_name'); // asumir full_name generada
        } catch(_){}
        continue; // reintenta sin la columna
      }
      // Mapear errores comunes de Postgres a respuestas 400 específicas
      if (e && e.code) {
        if (e.code === '23502') return next(new AppError(400,'Campo requerido faltante','NOT_NULL_VIOLATION'));
        if (e.code === '23505') return next(new AppError(400,'Violación de unicidad','PATIENT_UNIQUE_VIOLATION'));
        if (e.code === '23514') return next(new AppError(400,'Violación de restricción','CHECK_CONSTRAINT_VIOLATION'));
        if (e.code === '23503') return next(new AppError(400,'Violación de llave foránea','FOREIGN_KEY_VIOLATION'));
      }
      // Structured log
      try {
        const columnsAttempted = (e && Array.isArray(updates)) ? updates.map(u=>u.split('=')[0]) : [];
        console.error('[PATIENT_UPDATE_FAIL]', JSON.stringify({
          code: e.code || null,
          message: e.message,
          columnsAttempted,
          payloadKeys: Object.keys(req.body||{}),
          retriedSchema,
          retriedGenerated,
          tenant: req.auth?.tenant_id || null
        }));
      } catch(logErr){ console.error('[PATIENT_UPDATE_FAIL][LOG_ERROR]', logErr.message); }
      return next(new AppError(500,'Error actualizando paciente','PATIENT_UPDATE_FAIL'));
    }
  }
});

router.delete('/:id', auth, audit('delete','patient', req=>req.params.id), async (req, res, next) => {
  try {
  const { rowCount } = await activePool(req).query('DELETE FROM patients WHERE id=$1', [req.params.id]);
    if (!rowCount) return next(new AppError(404,'Paciente no encontrado','PATIENT_NOT_FOUND'));
    res.status(204).send();
  } catch (e) { console.error(e); next(new AppError(500,'Error eliminando paciente','PATIENT_DELETE_FAIL')); }
});

module.exports = router;
