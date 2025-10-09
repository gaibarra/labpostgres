const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');

const router = express.Router();
function activePool(req){ return req.tenantPool || pool; }

// Introspection caches
let _hasAntibiogramResults = null;
let _hasAntibiotics = null;
async function ensureTables(req){
  const ap = activePool(req);
  if (_hasAntibiogramResults === null) {
    try {
      const { rows } = await ap.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='antibiogram_results'`);
      _hasAntibiogramResults = rows.length > 0;
    } catch { _hasAntibiogramResults = false; }
  }
  if (_hasAntibiotics === null) {
    try {
      const { rows } = await ap.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='antibiotics'`);
      _hasAntibiotics = rows.length > 0;
    } catch { _hasAntibiotics = false; }
  }
  return { hasResults: _hasAntibiogramResults, hasAntibiotics: _hasAntibiotics };
}

// GET /api/antibiogram/results?work_order_id=...&analysis_id=...&isolate_no=1
router.get('/results', auth, requirePermission('orders','read'), async (req,res,next)=>{
  try {
    const { hasResults } = await ensureTables(req);
    if (!hasResults) return res.json({ items: [] });
    const ap = activePool(req);
    const workOrderId = (req.query.work_order_id||'').toString().trim();
    const analysisId = (req.query.analysis_id||'').toString().trim();
    const isolateNo = parseInt(req.query.isolate_no,10) || 1;
    if (!workOrderId) return next(new AppError(400,'work_order_id requerido','BAD_REQUEST'));
    const where = ['work_order_id=$1'];
    const params = [workOrderId];
    if (analysisId) { where.push(`analysis_id=$2`); params.push(analysisId); }
    where.push(`isolate_no=$${params.length+1}`); params.push(isolateNo);
    const { rows } = await ap.query(
      `SELECT ar.*, ab.code AS antibiotic_code, ab.name AS antibiotic_name, ab.class AS antibiotic_class
       FROM antibiogram_results ar
       JOIN antibiotics ab ON ab.id = ar.antibiotic_id
       WHERE ${where.join(' AND ')}
       ORDER BY ab.name ASC`, params);
    return res.json({ items: rows });
  } catch (e) {
    console.error('[ANTIBIOGRAM_GET_FAIL]', e);
    return next(new AppError(500,'Error obteniendo resultados','ANTIBIOGRAM_GET_FAIL'));
  }
});

// POST /api/antibiogram/results (upsert array)
// Body: { work_order_id, analysis_id, isolate_no, organism, specimen_type, method, standard, standard_version, results: [ { antibiotic_code, measure_type, value_numeric, unit, interpretation, comments } ] }
router.post('/results', auth, requirePermission('orders','enter_results'), async (req,res,next)=>{
  try {
    const { hasResults, hasAntibiotics } = await ensureTables(req);
    if (!hasResults || !hasAntibiotics) return next(new AppError(400,'Esquema de antibiograma no disponible','ANTIBIOGRAM_SCHEMA_MISSING'));
    const ap = activePool(req);
    const { work_order_id, analysis_id, isolate_no = 1, organism, specimen_type, method, standard, standard_version, results } = req.body || {};
    if (!work_order_id || !Array.isArray(results)) return next(new AppError(400,'Payload inválido','BAD_REQUEST'));
    const iso = parseInt(isolate_no,10) || 1;

    // Prepare a temp map of antibiotic code -> id
    const codes = [...new Set(results.map(r=> String(r.antibiotic_code||'').trim()).filter(Boolean))];
    if (!codes.length) return res.json({ updated: 0, inserted: 0 });
    const { rows: abRows } = await ap.query('SELECT id, code FROM antibiotics WHERE code = ANY($1)', [codes]);
    const codeToId = new Map(abRows.map(r=> [r.code, r.id]));
    const unknown = codes.filter(c=> !codeToId.has(c));
    if (unknown.length) return next(new AppError(400,`Antibióticos desconocidos: ${unknown.join(', ')}`,'UNKNOWN_ANTIBIOTICS'));

    // Upsert within a transaction
    await ap.query('BEGIN');
    try {
      let inserted = 0, updated = 0;
      for (const r of results) {
        const abId = codeToId.get(String(r.antibiotic_code).trim());
        const measureType = r.measure_type ? String(r.measure_type).trim().toUpperCase() : null; // ZONE/MIC
        const valueNum = r.value_numeric == null || r.value_numeric === '' ? null : Number(r.value_numeric);
        const unit = r.unit ? String(r.unit).trim() : (measureType === 'ZONE' ? 'mm' : (measureType === 'MIC' ? 'ug/mL' : null));
        const interp = r.interpretation ? String(r.interpretation).trim().toUpperCase() : null; // S/I/R
        const comments = r.comments == null ? null : String(r.comments);

        const params = [
          work_order_id, analysis_id || null, iso, organism || null, specimen_type || null, method || null, standard || null, standard_version || null,
          abId, measureType, valueNum, unit, interp, comments
        ];
        const { rowCount } = await ap.query(
          `INSERT INTO antibiogram_results(
            work_order_id, analysis_id, isolate_no, organism, specimen_type, method, standard, standard_version,
            antibiotic_id, measure_type, value_numeric, unit, interpretation, comments
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT (work_order_id, analysis_id, isolate_no, antibiotic_id)
          DO UPDATE SET organism=EXCLUDED.organism, specimen_type=EXCLUDED.specimen_type, method=EXCLUDED.method,
                        standard=EXCLUDED.standard, standard_version=EXCLUDED.standard_version,
                        measure_type=EXCLUDED.measure_type, value_numeric=EXCLUDED.value_numeric, unit=EXCLUDED.unit,
                        interpretation=EXCLUDED.interpretation, comments=EXCLUDED.comments
          `, params);
        if (rowCount === 1) inserted++; else updated++; // INSERT ... ON CONFLICT returns 1 both cases; adjust via separate query if needed
      }
      await ap.query('COMMIT');
      return res.json({ ok: true, inserted, updated });
    } catch (e) {
      await ap.query('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('[ANTIBIOGRAM_UPSERT_FAIL]', e);
    return next(new AppError(500,'Error guardando resultados','ANTIBIOGRAM_UPSERT_FAIL'));
  }
});

// DELETE /api/antibiogram/results (bulk delete by antibiotics codes)
router.delete('/results', auth, requirePermission('orders','enter_results'), async (req,res,next)=>{
  try {
    const { hasResults, hasAntibiotics } = await ensureTables(req);
    if (!hasResults || !hasAntibiotics) return next(new AppError(400,'Esquema de antibiograma no disponible','ANTIBIOGRAM_SCHEMA_MISSING'));
    const { work_order_id, analysis_id, isolate_no = 1, antibiotic_codes = [] } = req.body || {};
    if (!work_order_id || !Array.isArray(antibiotic_codes) || antibiotic_codes.length === 0) return next(new AppError(400,'Payload inválido','BAD_REQUEST'));
    const iso = parseInt(isolate_no,10) || 1;
    const ap = activePool(req);
    const { rows: abRows } = await ap.query('SELECT id FROM antibiotics WHERE code = ANY($1)', [antibiotic_codes]);
    const ids = abRows.map(r=> r.id);
    const params = [work_order_id, analysis_id || null, iso];
    const { rowCount } = await ap.query(
      `DELETE FROM antibiogram_results
       WHERE work_order_id=$1 AND ($2::uuid IS NULL OR analysis_id=$2) AND isolate_no=$3
         AND antibiotic_id = ANY($4)`,
      [...params, ids]
    );
    return res.json({ deleted: rowCount });
  } catch (e) {
    console.error('[ANTIBIOGRAM_DELETE_FAIL]', e);
    return next(new AppError(500,'Error eliminando resultados','ANTIBIOGRAM_DELETE_FAIL'));
  }
});

module.exports = router;
