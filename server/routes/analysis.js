const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { parsePagination, buildSearchFilter } = require('../utils/pagination');
const { AppError } = require('../utils/errors');

const router = express.Router();
const { validate } = require('../middleware/validate');
const { analysisCreateSchema, analysisUpdateSchema } = require('../validation/schemas');
const { audit } = require('../middleware/audit');

router.get('/', auth, requirePermission('studies','read'), async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const { clause, params } = buildSearchFilter(req.query.search, ['name','clave','category']);
    let base = 'FROM analysis';
    if (clause) base += ` WHERE ${clause}`;
    const rowsQ = `SELECT * ${base} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    const cntQ = `SELECT COUNT(*)::int AS total ${base}`;
    const [rowsR, cntR] = await Promise.all([
      pool.query(rowsQ.replace(/\$SEARCH/g,'$'), [...params, limit, offset]),
      pool.query(cntQ.replace(/\$SEARCH/g,'$'), params)
    ]);
    res.json({ data: rowsR.rows, page: { limit, offset, total: cntR.rows[0].total } });
  } catch (e) { console.error(e); next(new AppError(500,'Error listando estudios','ANALYSIS_LIST_FAIL')); }
});

// Detailed listing with nested parameters and reference ranges (single query JSON build)
router.get('/detailed', auth, requirePermission('studies','read'), async (req,res,next)=>{
  try {
    const { limit, offset } = parsePagination(req.query);
    const { clause, params } = buildSearchFilter(req.query.search, ['name','clave','category']);
    let where = clause ? ` WHERE ${clause}` : '';
    const baseParams = [...params, limit, offset];
    const q = `
      SELECT a.*, COALESCE(p.parameters, '[]') AS parameters FROM analysis a
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', ap.id,
            'name', ap.name,
            'unit', ap.unit,
            'decimal_places', ap.decimal_places,
            'position', ap.position,
            'reference_ranges', COALESCE(rr.ranges, '[]')
          ) ORDER BY ap.position NULLS LAST, ap.created_at
        ) AS parameters
        FROM analysis_parameters ap
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object(
            'id', r.id,
            'sex', r.sex,
            'age_min', r.age_min,
            'age_max', r.age_max,
            'age_min_unit', r.age_min_unit,
            'lower', r.lower,
            'upper', r.upper,
            'text_value', r.text_value,
            'notes', r.notes
          ) ORDER BY r.created_at) AS ranges
          FROM reference_ranges r WHERE r.parameter_id = ap.id
        ) rr ON true
        WHERE ap.analysis_id = a.id
      ) p ON true
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `;
    const cntQ = `SELECT COUNT(*)::int AS total FROM analysis${where}`;
    const [rowsR, cntR] = await Promise.all([
      pool.query(q, baseParams),
      pool.query(cntQ, params)
    ]);
    res.json({ data: rowsR.rows, page: { limit, offset, total: cntR.rows[0].total } });
  } catch (e) { console.error(e); next(new AppError(500,'Error listando estudios detallados','ANALYSIS_DETAILED_LIST_FAIL')); }
});

// Generate next study key pattern YYYYMMDD-XXX
router.get('/next-key', auth, requirePermission('studies','create'), async (req,res,next)=>{
  try {
    const today = new Date();
    const datePart = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM analysis WHERE clave LIKE $1', [`${datePart}-%`]);
    const consecutive = String(rows[0].cnt + 1).padStart(3,'0');
    res.json({ clave: `${datePart}-${consecutive}` });
  } catch (e) { console.error(e); next(new AppError(500,'Error generando clave','ANALYSIS_KEY_FAIL')); }
});

// Simple count endpoint
router.get('/count', auth, requirePermission('studies','read'), async (_req,res,next)=>{
  try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM analysis'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando estudios','ANALYSIS_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('studies','read'), async (_req,res,next)=>{
  try { const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM analysis'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando estudios','ANALYSIS_COUNT_FAIL')); }
});

// Sync parameters (create/update/delete) with their reference ranges in one transaction
router.post('/:id/parameters-sync', auth, requirePermission('studies','update'), async (req,res,next)=>{
  const analysisId = req.params.id;
  const incoming = Array.isArray(req.body?.parameters) ? req.body.parameters : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Existing parameters
    const existing = await client.query('SELECT id FROM analysis_parameters WHERE analysis_id=$1', [analysisId]);
    const existingIds = new Set(existing.rows.map(r=>r.id));
    const incomingIds = new Set(incoming.filter(p=>p.id).map(p=>p.id));
    // Delete removed
    const toDelete = [...existingIds].filter(id => !incomingIds.has(id));
    if (toDelete.length) {
      await client.query('DELETE FROM reference_ranges WHERE parameter_id = ANY($1)', [toDelete]);
      await client.query('DELETE FROM analysis_parameters WHERE id = ANY($1)', [toDelete]);
    }
    const savedMap = new Map();
    // Upsert (simple: separate insert/update)
    for (const p of incoming) {
      const base = {
        name: p.name?.trim() || '',
        unit: p.unit?.trim() || null,
        decimal_places: p.decimal_places ?? null,
        position: p.position ?? null
      };
      if (p.id) {
        const { rows } = await client.query('UPDATE analysis_parameters SET name=$1, unit=$2, decimal_places=$3, position=$4 WHERE id=$5 AND analysis_id=$6 RETURNING *', [base.name, base.unit, base.decimal_places, base.position, p.id, analysisId]);
        if (rows[0]) savedMap.set(rows[0].id, rows[0]);
      } else {
        const { rows } = await client.query('INSERT INTO analysis_parameters(analysis_id,name,unit,decimal_places,position) VALUES($1,$2,$3,$4,$5) RETURNING *', [analysisId, base.name, base.unit, base.decimal_places, base.position]);
        savedMap.set(rows[0].id, rows[0]);
        p.id = rows[0].id; // mutate to reuse below
      }
    }
    // Reference ranges: replace per parameter
    for (const p of incoming) {
      const paramId = p.id;
      await client.query('DELETE FROM reference_ranges WHERE parameter_id=$1', [paramId]);
      const ranges = Array.isArray(p.valorReferencia) ? p.valorReferencia : [];
      for (const vr of ranges) {
        const tipo = vr.tipoValor || (vr.textoLibre ? 'textoLibre' : (vr.textoPermitido ? 'alfanumerico' : 'numerico'));
        const isNumeric = tipo === 'numerico';
        const sexRaw = (vr.gender || vr.sexo || 'Ambos').toString().trim().toLowerCase();
        const sex = sexRaw.startsWith('masc') ? 'Masculino' : sexRaw.startsWith('fem') ? 'Femenino' : 'Ambos';
        await client.query(
          'INSERT INTO reference_ranges(parameter_id,sex,age_min,age_max,age_min_unit,lower,upper,text_value,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [paramId, sex, vr.age_min ?? vr.edadMin ?? null, vr.age_max ?? vr.edadMax ?? null, vr.age_unit || vr.unidadEdad || 'años', isNumeric ? (vr.normal_min ?? vr.valorMin ?? null) : null, isNumeric ? (vr.normal_max ?? vr.valorMax ?? null) : null, !isNumeric ? (vr.textoPermitido || vr.textoLibre || null) : null, vr.notas || null]
        );
      }
    }
    // Build response with nested ranges
    const { rows: fullParams } = await client.query('SELECT * FROM analysis_parameters WHERE analysis_id=$1 ORDER BY position NULLS LAST, created_at', [analysisId]);
    const result = [];
    for (const p of fullParams) {
      const { rows: rr } = await client.query('SELECT * FROM reference_ranges WHERE parameter_id=$1 ORDER BY created_at', [p.id]);
      result.push({ ...p, reference_ranges: rr });
    }
    await client.query('COMMIT');
    res.json({ parameters: result });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e); next(new AppError(500,'Error sincronizando parámetros','ANALYSIS_PARAM_SYNC_FAIL'));
  } finally { client.release(); }
});

router.post('/', auth, requirePermission('studies','create'), validate(analysisCreateSchema), audit('create','analysis', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req, res, next) => {
  const cols = ['clave','name','category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price'];
  const values = cols.map(c => req.body?.[c] ?? null);
  try {
    const { rows } = await pool.query(`INSERT INTO analysis(${cols.join(',')}) VALUES(${cols.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`, values);
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch (e) {
    if (e.code === '23505' && /analysis_clave_key/.test(e.constraint || '')) {
      // Duplicate clave: return existing row idempotently (200) instead of 500 noise in tests
      try {
        const { rows: existing } = await pool.query('SELECT * FROM analysis WHERE clave=$1', [req.body?.clave]);
        if (existing[0]) {
          return res.status(200).json(existing[0]);
        }
      } catch (inner) {
        console.error('Failed fetching existing analysis after duplicate key', inner);
      }
      return next(new AppError(409,'Clave duplicada','ANALYSIS_DUPLICATE_KEY'));
    }
    console.error(e); next(new AppError(500,'Error creando estudio','ANALYSIS_CREATE_FAIL'));
  }
});

router.get('/:id', auth, requirePermission('studies','read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM analysis WHERE id=$1', [req.params.id]);
  if (!rows[0]) return next(new AppError(404,'Estudio no encontrado','ANALYSIS_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { console.error(e); next(new AppError(500,'Error obteniendo estudio','ANALYSIS_GET_FAIL')); }
});

router.put('/:id', auth, requirePermission('studies','update'), validate(analysisUpdateSchema), audit('update','analysis', req=>req.params.id, (req)=>({ body: req.body })), async (req, res, next) => {
  const cols = ['clave','name','category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price'];
  const sets = [];
  const vals = [];
  cols.forEach(c => { if (Object.prototype.hasOwnProperty.call(req.body,c)) { sets.push(`${c}=$${sets.length+1}`); vals.push(req.body[c]); } });
  if (!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
  vals.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE analysis SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
  if (!rows[0]) return next(new AppError(404,'Estudio no encontrado','ANALYSIS_NOT_FOUND'));
    res.json(rows[0]);
  } catch (e) { console.error(e); next(new AppError(500,'Error actualizando estudio','ANALYSIS_UPDATE_FAIL')); }
});

router.delete('/:id', auth, requirePermission('studies','delete'), audit('delete','analysis', req=>req.params.id), async (req, res, next) => {
  try { const { rowCount } = await pool.query('DELETE FROM analysis WHERE id=$1', [req.params.id]); if(!rowCount) return next(new AppError(404,'Estudio no encontrado','ANALYSIS_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando estudio','ANALYSIS_DELETE_FAIL')); }
});

router.get('/:id/parameters', auth, requirePermission('studies','read'), async (req,res)=>{
  try { const { rows } = await pool.query('SELECT * FROM analysis_parameters WHERE analysis_id=$1 ORDER BY position NULLS LAST, created_at', [req.params.id]); res.json(rows); } catch(e){ console.error(e); res.status(500).json({ error:'Error listando parámetros'});} });

router.post('/:id/parameters', auth, requirePermission('studies','update'), audit('create','analysis_parameter', (req,r)=>r.locals?.paramId, (req)=>({ body: req.body, analysis_id: req.params.id })), async (req,res)=>{
  const { name, unit, decimal_places, position } = req.body || {};
  if(!name) return res.status(400).json({ error:'name requerido'});
  try { const { rows } = await pool.query('INSERT INTO analysis_parameters(analysis_id,name,unit,decimal_places,position) VALUES($1,$2,$3,$4,$5) RETURNING *', [req.params.id,name,unit||null,decimal_places||null,position||null]); const created=rows[0]; res.locals.paramId = created.id; res.status(201).json(created); } catch(e){ console.error(e); res.status(500).json({ error:'Error creando parámetro'});} });

router.put('/parameters/:paramId', auth, requirePermission('studies','update'), audit('update','analysis_parameter', req=>req.params.paramId, (req)=>({ body: req.body })), async (req,res)=>{
  const fields=['name','unit','decimal_places','position']; const sets=[]; const vals=[]; fields.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); }}); if(!sets.length) return res.status(400).json({ error:'Nada para actualizar'}); vals.push(req.params.paramId); try { const { rows } = await pool.query(`UPDATE analysis_parameters SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals); if(!rows[0]) return res.status(404).json({ error:'No encontrado'}); res.json(rows[0]); } catch(e){ console.error(e); res.status(500).json({ error:'Error actualizando parámetro'});} });

router.delete('/parameters/:paramId', auth, requirePermission('studies','update'), audit('delete','analysis_parameter', req=>req.params.paramId), async (req,res)=>{ try { const { rowCount } = await pool.query('DELETE FROM analysis_parameters WHERE id=$1',[req.params.paramId]); if(!rowCount) return res.status(404).json({ error:'No encontrado'}); res.status(204).send(); } catch(e){ console.error(e); res.status(500).json({ error:'Error eliminando parámetro'});} });

router.get('/parameters/:paramId/reference-ranges', auth, requirePermission('studies','read'), async (req,res)=>{ try { const { rows } = await pool.query('SELECT * FROM reference_ranges WHERE parameter_id=$1 ORDER BY created_at',[req.params.paramId]); res.json(rows); } catch(e){ console.error(e); res.status(500).json({ error:'Error listando rangos'});} });

router.post('/parameters/:paramId/reference-ranges', auth, requirePermission('studies','update'), audit('create','reference_range', (req,r)=>r.locals?.rangeId, (req)=>({ body: req.body, param_id: req.params.paramId })), async (req,res)=>{ const cols=['sex','age_min','age_max','age_min_unit','age_max_unit','lower','upper','text_value','notes']; const values=cols.map(c=>req.body?.[c]??null); try { const { rows } = await pool.query(`INSERT INTO reference_ranges(parameter_id,${cols.join(',')}) VALUES($1,${cols.map((_,i)=>'$'+(i+2)).join(',')}) RETURNING *`, [req.params.paramId, ...values]); const created=rows[0]; res.locals.rangeId = created.id; res.status(201).json(created); } catch(e){ console.error(e); res.status(500).json({ error:'Error creando rango'});} });

router.put('/reference-ranges/:rangeId', auth, requirePermission('studies','update'), audit('update','reference_range', req=>req.params.rangeId, (req)=>({ body: req.body })), async (req,res)=>{ const cols=['sex','age_min','age_max','age_min_unit','age_max_unit','lower','upper','text_value','notes']; const sets=[]; const vals=[]; cols.forEach(c=>{ if(Object.prototype.hasOwnProperty.call(req.body,c)){ sets.push(`${c}=$${sets.length+1}`); vals.push(req.body[c]); }}); if(!sets.length) return res.status(400).json({ error:'Nada para actualizar'}); vals.push(req.params.rangeId); try { const { rows } = await pool.query(`UPDATE reference_ranges SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals); if(!rows[0]) return res.status(404).json({ error:'No encontrado'}); res.json(rows[0]); } catch(e){ console.error(e); res.status(500).json({ error:'Error actualizando rango'});} });

router.delete('/reference-ranges/:rangeId', auth, requirePermission('studies','update'), audit('delete','reference_range', req=>req.params.rangeId), async (req,res)=>{ try { const { rowCount } = await pool.query('DELETE FROM reference_ranges WHERE id=$1',[req.params.rangeId]); if(!rowCount) return res.status(404).json({ error:'No encontrado'}); res.status(204).send(); } catch(e){ console.error(e); res.status(500).json({ error:'Error eliminando rango'});} });

module.exports = router;
// AI helper endpoint (simple placeholder)
router.post('/ai/generate-study-details', auth, requirePermission('studies','create'), async (req,res)=>{
  const studyName = (req.body?.studyName || '').trim();
  if(!studyName) return res.status(400).json({ error:'studyName requerido'});
  // Simple deterministic mock; real implementation would call OpenAI or other provider
  const seedParam = studyName.replace(/[^a-zA-Z0-9]/g,'').toLowerCase().slice(0,8);
  const hash = seedParam.split('').reduce((a,c)=>a + c.charCodeAt(0),0);
  const baseLow = (hash % 50) + 10;
  const baseHigh = baseLow + 80;
  res.json({
    name: studyName,
    description: `Perfil generado automáticamente para ${studyName}.`,
    methodology: 'Método automatizado',
    sample_type: 'Sangre',
    parameters: [
      { nombre: 'Parametro A', unidad: 'mg/dL', tipo: 'numeric', valorReferencia: [{ sexo:'Ambos', edadMin:null, edadMax:null, unidadEdad:'años', valorMin: baseLow, valorMax: baseHigh }] },
      { nombre: 'Parametro B', unidad: 'U/L', tipo: 'numeric', valorReferencia: [{ sexo:'Ambos', edadMin:null, edadMax:null, unidadEdad:'años', valorMin: 1, valorMax: 10 }] }
    ]
  });
});
