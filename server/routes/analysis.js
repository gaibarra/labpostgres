const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { parsePagination, buildSearchFilter } = require('../utils/pagination');
const { AppError } = require('../utils/errors');
const { hashCatalog } = require('../utils/catalogHash');

const router = express.Router();
function activePool(req){ return req.tenantPool || pool; }
// Eliminados validate, analysisCreateSchema, analysisUpdateSchema (no usados) para limpiar lint.
const { audit } = require('../middleware/audit');

// --- Sex tokens dynamic normalization ---------------------------------------
// La base de datos puede tener distintas variantes históricas del constraint
// sobre reference_ranges.sex (lowercase vs capitalizado, diferentes nombres
// de constraint). Para evitar 400 inesperados cuando el código y la BD se
// desalinean, detectamos en runtime los tokens exactos permitidos y los usamos
// como fuente de verdad para normalizar entradas.
let _sexTokensStyle = { Ambos: 'Ambos', Masculino: 'Masculino', Femenino: 'Femenino' }; // default capitalizado
let _sexTokensDetected = ['Ambos','Masculino','Femenino'];

// Bridge temporal: si la BD solamente tiene constraint legacy (M/F/O) y aún no se ha aplicado
// la migración canónica, convertimos antes de insertar. Una vez migrado, este bloque se puede retirar.
function bridgeToLegacyIfNeeded(sex){
  try {
    if (sexConstraintCache && sexConstraintCache.legacyPresent && !sexConstraintCache.canonicalPresent) {
      if (sex === _sexTokensStyle.Ambos) return 'O';
      if (sex === _sexTokensStyle.Masculino) return 'M';
      if (sex === _sexTokensStyle.Femenino) return 'F';
    }
  } catch(err){ /* swallow: fallback al valor original */ }
  return sex;
}

function adoptSexTokens(tokens){
  if (!Array.isArray(tokens) || tokens.length < 2) return; // ignorar anomalías
  // Esperamos tres tokens semánticos (ambos/masculino/femenino) en cualquier casing.
  const map = {};
  const lc = tokens.map(t=>String(t).trim()).filter(Boolean);
  const findToken = (semantic)=>{
    const hit = lc.find(t=>t.toLowerCase().startsWith(semantic.slice(0,1)) || t.toLowerCase() === semantic);
    return hit || semantic.charAt(0).toUpperCase()+semantic.slice(1);
  };
  map.Ambos = findToken('ambos');
  map.Masculino = findToken('masculino');
  map.Femenino = findToken('femenino');
  _sexTokensStyle = map;
  _sexTokensDetected = [map.Ambos, map.Masculino, map.Femenino];
}

function normalizeSex(raw){
  if (!raw) return _sexTokensStyle.Ambos;
  const v = String(raw).trim().toLowerCase();
  if (v.startsWith('m')) return _sexTokensStyle.Masculino;
  if (v.startsWith('f')) return _sexTokensStyle.Femenino;
  if (v.startsWith('a')) return _sexTokensStyle.Ambos;
  if (['masculino','femenino','ambos'].includes(v)) {
    // Mantener estilo detectado
    if (v === 'masculino') return _sexTokensStyle.Masculino;
    if (v === 'femenino') return _sexTokensStyle.Femenino;
    return _sexTokensStyle.Ambos;
  }
  // Fallback defensivo: preferimos token neutro que siempre pasa constraint
  return _sexTokensStyle.Ambos;
}
// --- Reference range backend normalization helpers ------------------------
// (Los segmentos fallback se definen en frontend; aquí no necesitamos la constante explícita.)

function coerceInt(v){ if (v==null || v==='') return null; const n = Number(v); return Number.isFinite(n)? n : null; }
function coerceNum(v){ if (v==null || v==='') return null; const n = Number(v); return Number.isFinite(n)? n : null; }

/**
 * Normaliza, expande cobertura 0-120 y detecta superposiciones.
 * Reglas:
 *  - Un rango sin edad (age_min/max null) para un sexo cubre todo (0-120) -> no se generan placeholders.
 *  - Para cada sexo presente, se rellenan huecos entre 0 y 120 con placeholders (lower/upper null, notes='Auto-fill gap').
 *  - Rangos que se traslapan (overlap) para mismo sexo generan error.
 *  - Si sólo existe sexo 'Ambos' se trata como único grupo.
 */
function expandAndValidateRanges(rawRanges){
  const normalized = [];
  for (const r of (rawRanges||[])) {
    if (!r) continue;
    const sex = normalizeSex(r.gender || r.sexo || r.sex);
    const age_min = coerceInt(r.age_min ?? r.edadMin ?? r.min ?? null);
    const age_max = coerceInt(r.age_max ?? r.edadMax ?? r.max ?? null);
    const lower = coerceNum(r.lower ?? r.valorMin ?? r.min_value ?? null);
    const upper = coerceNum(r.upper ?? r.valorMax ?? r.max_value ?? null);
    const age_min_unit = r.age_min_unit || r.age_unit || r.unidadEdad || 'años';
    const text_value = r.text_value || r.textoPermitido || r.textoLibre || null;
    const notes = r.notes || r.notas || null;
    const unit = r.unit || r.unidad || null;
    // Ignorar filas completamente vacías (sin límites, texto ni notas)
    if (lower==null && upper==null && !text_value && !notes) continue;
    normalized.push({ sex, age_min, age_max, age_min_unit, lower, upper, text_value, notes, unit });
  }
  if (!normalized.length) return []; // nada que insertar
  const sexes = Array.from(new Set(normalized.map(r=>r.sex)));
  const isOnlyAmbos = sexes.length === 1 && sexes[0] === _sexTokensStyle.Ambos;
  const groups = isOnlyAmbos ? { [_sexTokensStyle.Ambos]: normalized } : normalized.reduce((acc,r)=>{ (acc[r.sex]=acc[r.sex]||[]).push(r); return acc; }, {});
  const finalOut = [];
  const processGroup = (sex, list) => {
    // Si cualquier rango cubre toda la vida (null-null) tratamos como cobertura completa
    const hasAllLife = list.some(r=> r.age_min==null && r.age_max==null);
    if (hasAllLife) {
      // Mantener sólo el primer rango que cubre todo para evitar insertar duplicados vacíos
      const first = list.find(r=> r.age_min==null && r.age_max==null);
      finalOut.push({ ...first, sex, age_min:null, age_max:null });
      return;
    }
      // --- Deduplicación estricta de spans idénticos (evita falsos solapamientos) ---
      if (list.length > 1) {
        const bySpan = new Map(); // key: a|b -> record con preferencia por uno que tenga datos
        for (const r of list) {
          const k = `${r.age_min}|${r.age_max}`;
          const existing = bySpan.get(k);
          const hasVals = (r.lower!=null || r.upper!=null || r.text_value);
          if (!existing) { bySpan.set(k, r); continue; }
          const existingHasVals = (existing.lower!=null || existing.upper!=null || existing.text_value);
            if (!existingHasVals && hasVals) { bySpan.set(k, r); }
          // Si ambos tienen valores, conservamos el primero (determinismo) y descartamos duplicado silenciosamente
        }
        list = Array.from(bySpan.values());
      }
    // Normalizar límites nulos -> clamp en extremos para cálculo de gaps (sin mutar original para persistencia)
    const ordered = list.map(r=>({ ...r, _amin: r.age_min==null?0:r.age_min, _amax: r.age_max==null?120:r.age_max }))
      .sort((a,b)=> a._amin - b._amin || a._amax - b._amax);
    // Detectar overlaps reales
    // Pre-fusión de casos de contención donde uno sea placeholder (sin lower/upper/text_value)
    for (let i=1;i<ordered.length;i++){
      const prev = ordered[i-1];
      const curr = ordered[i];
      const prevIsPlaceholder = prev.lower==null && prev.upper==null && !prev.text_value;
      const currIsPlaceholder = curr.lower==null && curr.upper==null && !curr.text_value;
      // Caso específico reportado: prev 0-1, curr 0-17 (u otro mayor) para mismo sexo.
      // Si ambos comienzan igual y el actual se extiende más:
      if (curr._amin === prev._amin && curr._amax > prev._amax) {
        // Si el anterior es placeholder y el actual tiene datos -> sustituir
        if (prevIsPlaceholder && !currIsPlaceholder) {
          ordered[i-1] = curr; ordered.splice(i,1); i--; continue;
        }
        // Si el actual es placeholder y el anterior tiene datos -> descartar actual
        if (currIsPlaceholder && !prevIsPlaceholder) {
          ordered.splice(i,1); i--; continue;
        }
        // Si ambos son placeholder conservar el más amplio
        if (prevIsPlaceholder && currIsPlaceholder) {
          ordered[i-1] = curr; ordered.splice(i,1); i--; continue;
        }
      }
      // Caso inverso (curr contenido totalmente dentro de prev y placeholder)
      if (curr._amin >= prev._amin && curr._amax <= prev._amax) {
        if (currIsPlaceholder && !prevIsPlaceholder) { ordered.splice(i,1); i--; continue; }
        if (currIsPlaceholder && prevIsPlaceholder) { ordered.splice(i,1); i--; continue; }
      }
    }
    // Detección final de solapamientos reales (ya deduplicados contenedores placeholder)
    for (let i=1;i<ordered.length;i++) {
      const prev = ordered[i-1];
      const curr = ordered[i];
      if (curr._amin < prev._amax) {
        // Permitimos adyacencia exacta (_amin === _amax)
        if (curr._amin === prev._amax) continue;
        throw new AppError(400,`Rangos superpuestos (${sex})`,`REFERENCE_RANGE_OVERLAP`, { sex, prev: { age_min: prev.age_min, age_max: prev.age_max }, curr: { age_min: curr.age_min, age_max: curr.age_max } });
      }
    }
    // Relleno de huecos 0-120
    let cursor = 0;
    for (const r of ordered){
      if (r._amin > 120) break; // fuera de rango
      if (r._amin > cursor) {
        finalOut.push({ sex, age_min: cursor, age_max: Math.min(r._amin-1,120), age_min_unit: 'años', lower: null, upper: null, text_value: null, notes: 'Auto-fill gap', unit: null });
      }
      // Insertar original (sin campos internos _amin/_amax)
      const persisted = { ...r }; delete persisted._amin; delete persisted._amax; finalOut.push(persisted);
      cursor = Math.max(cursor, r._amax + 1);
      if (cursor>120) break;
    }
    if (cursor <= 120) {
      finalOut.push({ sex, age_min: cursor, age_max: 120, age_min_unit:'años', lower:null, upper:null, text_value:null, notes:'Auto-fill gap', unit:null });
    }
  };
  if (isOnlyAmbos) processGroup(_sexTokensStyle.Ambos, groups[_sexTokensStyle.Ambos]);
  else {
    Object.entries(groups).forEach(([sex,list])=> processGroup(sex,list));
  }
  return finalOut;
}

// --- Dynamic schema adaptation (simplificado; sex mode deprecated) -----------
let analysisColumnsCache = null;
let sexConstraintCache = null; // { tokens:[], meta:[], ts }
async function loadAnalysisSchema(req){
  const db = activePool(req);
  if (!analysisColumnsCache) {
    const colSet = async (table)=>{
      const { rows } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
      return new Set(rows.map(r=>r.column_name));
    };
    const [aCols, pCols, legacyRCols, modernRCols] = await Promise.all([
      colSet('analysis'),
      colSet('analysis_parameters'),
      colSet('reference_ranges'),
      colSet('analysis_reference_ranges').catch(()=> new Set())
    ]);
    analysisColumnsCache = { aCols, pCols, rCols: modernRCols.size ? modernRCols : legacyRCols, modernRanges: modernRCols.size>0, legacyRanges: legacyRCols.size>0 };
    console.info('[ANALYSIS][SCHEMA] cached columns (analysis, parameters, ranges=%s source=%s)', analysisColumnsCache.rCols.size, analysisColumnsCache.modernRanges?'modern':'legacy');
  }
  // Refrescar constraint (cada 60s máximo) para soportar migraciones en caliente.
  const now = Date.now();
  if (!sexConstraintCache || (now - sexConstraintCache.ts) > 60000) {
    try {
      const { rows } = await db.query(`
        SELECT c.conname, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname='reference_ranges'
          AND c.contype='c'
          AND pg_get_constraintdef(c.oid) ILIKE '%sex%'
      `);
  const meta = rows;
  let tokens = null;
      const extractQuoted = (def)=>{
        const found = [];
        const re = /'([^']+)'/g; let m;
        while ((m = re.exec(def))) { found.push(m[1]); }
        return [...new Set(found)];
      };
      // Reordenar priorizando constraints que ya tengan 'Ambos'
      const ordered = [...meta].sort((a,b)=>{
        const aCanon = /'ambos'/i.test(a.def) ? 0 : 1;
        const bCanon = /'ambos'/i.test(b.def) ? 0 : 1;
        return aCanon - bCanon;
      });
      for (const m of ordered) {
        // 1) Intento patrón directo IN (...)
        const matchIn = m.def.match(/sex\s+IN\s*\(([^)]+)\)/i);
        if (matchIn) {
          const rawList = matchIn[1];
          const parts = rawList.split(',').map(p=>p.trim().replace(/^'(.*)'$/,'$1').replace(/'::text$/,'')).filter(Boolean);
          if (parts.length >= 2) { tokens = parts; break; }
        }
        // 2) Intento patrón ANY(ARRAY['a'::text,'b'::text,...])
        if (!tokens && /ANY\s*\(ARRAY/i.test(m.def)) {
          const quoted = extractQuoted(m.def);
          // Heurística: quedarnos con strings cuyo lowercase está entre {ambos, masculino, femenino}
          const candidates = quoted.filter(v=>['ambos','masculino','femenino'].includes(v.toLowerCase()))
            .sort((a,b)=> a.toLowerCase().localeCompare(b.toLowerCase()));
          if (candidates.length >= 2) { tokens = candidates; break; }
        }
      }
      // 3) Último recurso: tomar cualquier triple única amb|mas|fem encontrada en constraints con sex
      if (!tokens) {
        for (const m of meta) {
          const quoted = extractQuoted(m.def);
          const triples = quoted.filter(v=>['ambos','masculino','femenino'].includes(v.toLowerCase()));
          if (triples.length) { tokens = triples; break; }
        }
      }
      if (tokens) {
        adoptSexTokens(tokens);
      }
  const legacyPresent = meta.some(m=> /'M'::text/.test(m.def) && /'F'::text/.test(m.def) && /'O'::text/.test(m.def));
  const canonicalPresent = meta.some(m=> /'Ambos'|'ambos'/.test(m.def));
  sexConstraintCache = { tokens: _sexTokensDetected.slice(), meta, ts: now, legacyPresent, canonicalPresent };
    } catch (e) {
      console.warn('[ANALYSIS][SCHEMA] no se pudo introspectar constraint sex', e.message);
      sexConstraintCache = { tokens: _sexTokensDetected.slice(), meta: [], ts: now };
    }
  }
  return {
    ...analysisColumnsCache,
    sexMode: 'dynamic',
    sexModeReason: 'constraint-introspection',
    sexConstraintsMeta: sexConstraintCache.meta,
    allowedSexTokens: _sexTokensDetected.slice()
  };
}

function projectAnalysis(row, schema){
  if (!row) return row;
  const { aCols } = schema;
  const keyVal = aCols.has('clave') ? row.clave : (row.code || null);
  return {
    id: row.id,
    clave: keyVal,
    name: row.name || null,
    category: aCols.has('category') ? row.category : null,
    description: aCols.has('description') ? row.description : null,
    indications: aCols.has('indications') ? row.indications : null,
    sample_type: aCols.has('sample_type') ? row.sample_type : null,
    sample_container: aCols.has('sample_container') ? row.sample_container : null,
    processing_time_hours: aCols.has('processing_time_hours') ? row.processing_time_hours : null,
    general_units: aCols.has('general_units') ? row.general_units : null,
    price: aCols.has('price') ? row.price : null,
    active: aCols.has('active') ? row.active : null,
    created_at: row.created_at
  };
}

function unifyRange(r, schema){
  const { rCols } = schema;
  // Valor ya persistido capitalizado; fallback defensivo si llega en minúsculas.
  let outwardSex = r.sex || null;
  if (outwardSex) {
    // Bridge visual: mapear legacy single-letter a tokens canónicos detectados
    if (outwardSex === 'M') outwardSex = _sexTokensStyle.Masculino;
    else if (outwardSex === 'F') outwardSex = _sexTokensStyle.Femenino;
    else if (outwardSex === 'O') outwardSex = _sexTokensStyle.Ambos;
    else if (outwardSex === outwardSex.toLowerCase()) {
      outwardSex = outwardSex.charAt(0).toUpperCase() + outwardSex.slice(1);
    }
  }
  const rawLower = rCols.has('lower') ? r.lower : (r.min_value ?? null);
  const rawUpper = rCols.has('upper') ? r.upper : (r.max_value ?? null);
  // Convertir numeric (string) a Number si es convertible
  const toNum = (v)=> (v===null || v===undefined || v==='') ? null : (typeof v === 'number' ? v : (Number.isFinite(Number(v)) ? Number(v) : null));
  return {
    id: r.id,
    sex: outwardSex,
    age_min: r.age_min ?? null,
    age_max: r.age_max ?? null,
    age_min_unit: rCols.has('age_min_unit') ? (r.age_min_unit || null) : null,
    lower: toNum(rawLower),
    upper: toNum(rawUpper),
    text_value: rCols.has('text_value') ? r.text_value : null,
    notes: rCols.has('notes') ? r.notes : null,
    unit: rCols.has('unit') ? r.unit : null
  };
}

function unifyParameter(p, schema, ranges){
  const { pCols } = schema;
  return {
    id: p.id,
    name: p.name,
    unit: p.unit || null,
    decimal_places: pCols.has('decimal_places') ? p.decimal_places : null,
    position: pCols.has('position') ? p.position : null,
    reference_ranges: (ranges || [])
      .slice()
      .sort((a,b)=> (a.age_min ?? -1) - (b.age_min ?? -1) || (a.age_max ?? 9999) - (b.age_max ?? 9999) || String(a.sex).localeCompare(String(b.sex)))
      .map(rr => unifyRange(rr, schema))
  };
}

router.get('/', auth, requirePermission('studies','read'), async (req, res, next) => {
  try {
    const schema = await loadAnalysisSchema(req);
    const { limit, offset } = parsePagination(req.query);
    const searchFields = ['name'];
    if (schema.aCols.has('clave')) searchFields.push('clave');
    if (schema.aCols.has('code')) searchFields.push('code');
    if (schema.aCols.has('category')) searchFields.push('category');
    const { clause, params } = buildSearchFilter(req.query.search, searchFields);
    const cols = ['id','name','created_at'];
    ['clave','code','category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price','active']
      .forEach(c=> schema.aCols.has(c) && cols.push(c));
    let base = 'FROM analysis';
    if (clause) base += ` WHERE ${clause}`;
    const rowsQ = `SELECT ${cols.join(', ')} ${base} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    const cntQ = `SELECT COUNT(*)::int AS total ${base}`;
    const [rowsR, cntR] = await Promise.all([
      activePool(req).query(rowsQ, [...params, limit, offset]),
      activePool(req).query(cntQ, params)
    ]);
    res.json({ data: rowsR.rows.map(r=>projectAnalysis(r, schema)), page: { limit, offset, total: cntR.rows[0].total } });
  } catch (e) { console.error(e); next(new AppError(500,'Error listando estudios','ANALYSIS_LIST_FAIL')); }
});

// Detailed listing with nested parameters and reference ranges (single query JSON build)
router.get('/detailed', auth, requirePermission('studies','read'), async (req,res,next)=>{
  try {
    const schema = await loadAnalysisSchema(req);
    const { limit, offset } = parsePagination(req.query);
    const searchFields = ['name'];
    if (schema.aCols.has('clave')) searchFields.push('clave');
    if (schema.aCols.has('code')) searchFields.push('code');
    if (schema.aCols.has('category')) searchFields.push('category');
    const { clause, params } = buildSearchFilter(req.query.search, searchFields);
    let base = 'FROM analysis';
    if (clause) base += ` WHERE ${clause}`;
    const selectCols = ['id','name','created_at'];
    ['clave','code','category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price','active']
      .forEach(c=> schema.aCols.has(c) && selectCols.push(c));
    const rowsQ = `SELECT ${selectCols.join(', ')} ${base} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    const cntQ = `SELECT COUNT(*)::int AS total ${base}`;
    const [rowsR, cntR] = await Promise.all([
      activePool(req).query(rowsQ, [...params, limit, offset]),
      activePool(req).query(cntQ, params)
    ]);
    const list = rowsR.rows.map(r=>projectAnalysis(r, schema));
    const ids = list.map(a=>a.id);
    if (ids.length) {
      const pSelect = ['id','analysis_id','name','unit','created_at'];
      if (schema.pCols.has('position')) pSelect.push('position');
      if (schema.pCols.has('decimal_places')) pSelect.push('decimal_places');
      const { rows: paramRows } = await activePool(req).query(`SELECT ${pSelect.join(', ')} FROM analysis_parameters WHERE analysis_id = ANY($1) ORDER BY position NULLS LAST, created_at`, [ids]);
      const paramIds = paramRows.map(p=>p.id);
      let rangeRows = [];
      if (paramIds.length) {
  const rTable = schema.modernRanges ? 'analysis_reference_ranges' : 'reference_ranges';
  const rSelect = ['id','parameter_id','sex','age_min','age_max','created_at'];
        if (schema.rCols.has('age_min_unit')) rSelect.push('age_min_unit');
        if (schema.rCols.has('lower')) { rSelect.push('lower','upper'); }
        else if (schema.rCols.has('min_value')) { rSelect.push('min_value','max_value'); }
        if (schema.rCols.has('text_value')) rSelect.push('text_value');
        if (schema.rCols.has('notes')) rSelect.push('notes');
        if (schema.rCols.has('unit')) rSelect.push('unit');
  const { rows } = await activePool(req).query(`SELECT ${rSelect.join(', ')} FROM ${rTable} WHERE parameter_id = ANY($1) ORDER BY created_at`, [paramIds]);
        rangeRows = rows;
      }
      const rangesByParam = rangeRows.reduce((acc,r)=>{ (acc[r.parameter_id] = acc[r.parameter_id] || []).push(r); return acc; }, {});
      const paramsByAnalysis = {};
      paramRows.forEach(pr => {
        const unified = unifyParameter(pr, schema, rangesByParam[pr.id] || []);
        (paramsByAnalysis[pr.analysis_id] = paramsByAnalysis[pr.analysis_id] || []).push(unified);
      });
      list.forEach(a => { a.parameters = paramsByAnalysis[a.id] || []; });
    }
    res.json({ data: list, page: { limit, offset, total: cntR.rows[0].total } });
  } catch (e) { console.error(e); next(new AppError(500,'Error listando estudios detallados','ANALYSIS_DETAILED_LIST_FAIL')); }
});

// Generate next study key pattern YYYYMMDD-XXX
router.get('/next-key', auth, requirePermission('studies','create'), async (req,res,next)=>{
  try {
    const schema = await loadAnalysisSchema(req);
    const keyCol = schema.aCols.has('clave') ? 'clave' : (schema.aCols.has('code') ? 'code' : null);
    if (!keyCol) return res.json({ clave:null, code:null });
    const today = new Date();
    const datePart = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const { rows } = await activePool(req).query(`SELECT COUNT(*)::int AS cnt FROM analysis WHERE ${keyCol} LIKE $1`, [`${datePart}-%`]);
    const consecutive = String(rows[0].cnt + 1).padStart(3,'0');
    const value = `${datePart}-${consecutive}`;
    res.json({ clave: value, code: value });
  } catch (e) { console.error(e); next(new AppError(500,'Error generando clave','ANALYSIS_KEY_FAIL')); }
});

// Simple count endpoint
router.get('/count', auth, requirePermission('studies','read'), async (req,res,next)=>{
  try { const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS total FROM analysis'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando estudios','ANALYSIS_COUNT_FAIL')); }
});
router.get('/count/all', auth, requirePermission('studies','read'), async (req,res,next)=>{
  try { const { rows } = await activePool(req).query('SELECT COUNT(*)::int AS total FROM analysis'); res.json({ total: rows[0].total }); }
  catch(e){ console.error(e); next(new AppError(500,'Error contando estudios','ANALYSIS_COUNT_FAIL')); }
});

// Endpoint de diagnóstico para inspeccionar el modo de sexo detectado
// Endpoint legacy mantenido para no romper clientes, retorna valores fijos
router.get('/sex-mode', auth, requirePermission('studies','read'), async (req,res)=>{
  res.json({ mode: 'capitalized', reason: 'deprecated-fixed', constraints: [], tokens: ['Ambos','Masculino','Femenino'] });
});

// Nuevo endpoint diagnóstico dinámico (usa la introspección real)
router.get('/sex-diagnostics', auth, requirePermission('studies','read'), async (req,res)=>{
  try {
    const schema = await loadAnalysisSchema(req);
    res.json({
      mode: schema.sexMode,
      reason: schema.sexModeReason,
      allowedTokens: schema.allowedSexTokens,
      constraints: schema.sexConstraintsMeta,
      ts: Date.now()
    });
  } catch(e){
    console.error('[ANALYSIS][SEX-DIAGNOSTICS]', e);
    res.status(500).json({ error:'fail diagnostics'});
  }
});

// Endpoint de auditoría ampliada de constraints de sex
router.get('/sex-constraints-audit', auth, requirePermission('studies','read'), async (req,res)=>{
  try {
    // Fuerza refresco de constraints ignorando TTL
    sexConstraintCache = null;
    const schema = await loadAnalysisSchema(req);
    const meta = schema.sexConstraintsMeta || [];
    // Clasificar constraints
    const classify = def => {
      if (!def) return 'unknown';
      const lc = def.toLowerCase();
      const hasAmbos = lc.includes("'ambos'");
      const hasMas = lc.includes("'masculino'");
      const hasFem = lc.includes("'femenino'");
      const legacyMFO = lc.includes("'m'::text") && lc.includes("'f'::text") && lc.includes("'o'::text");
      if (hasAmbos && hasMas && hasFem) return 'canonical';
      if (legacyMFO) return 'legacy_mfo';
      return 'other';
    };
    const enriched = meta.map(m=>({ ...m, classification: classify(m.def) }));
    const canonical = enriched.filter(e=>e.classification==='canonical');
    const legacy = enriched.filter(e=>e.classification==='legacy_mfo');
    const mismatch = canonical.length === 0 || legacy.length > 0;
    // search_path para detectar schema divergente
    let searchPath = null; let currentDb = null;
  try { const { rows: sp } = await activePool(req).query('SHOW search_path'); searchPath = sp[0].search_path; } catch(err){ /* ignore */ }
  try { const { rows: dbn } = await activePool(req).query('SELECT current_database() AS db'); currentDb = dbn[0].db; } catch(err){ /* ignore */ }
    res.json({
      tokensInUse: schema.allowedSexTokens,
      constraints: enriched,
      counts: { total: enriched.length, canonical: canonical.length, legacy: legacy.length },
      mismatch,
      searchPath,
      currentDb,
      ts: Date.now()
    });
  } catch(e){
    console.error('[ANALYSIS][SEX-AUDIT]', e);
    res.status(500).json({ error:'audit failed'});
  }
});

// Sync parameters (create/update/delete) with their reference ranges in one transaction
router.post('/:id/parameters-sync', auth, requirePermission('studies','update'), async (req,res,next)=>{
  const analysisId = req.params.id;
  const incoming = Array.isArray(req.body?.parameters) ? req.body.parameters : [];
  const client = await activePool(req).connect();
  try {
  const schema = await loadAnalysisSchema(req);
  const requestId = Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const constraintSummary = (schema.sexConstraintsMeta||[]).map(c=>`${c.conname}:${(c.def||'').slice(0,60)}`).join(';');
  console.info(`[ANALYSIS][SYNC][${requestId}] start analysis=${analysisId} incoming_params=${incoming.length} sexMode=${schema.sexMode} reason=${schema.sexModeReason} constraints=${constraintSummary}`);
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM analysis_parameters WHERE analysis_id=$1', [analysisId]);
    const existingIds = new Set(existing.rows.map(r=>r.id));
    const incomingIds = new Set(incoming.filter(p=>p.id).map(p=>p.id));
    const toDelete = [...existingIds].filter(id => !incomingIds.has(id));
    if (toDelete.length) {
      const rTableDel = schema.modernRanges ? 'analysis_reference_ranges' : 'reference_ranges';
      await client.query(`DELETE FROM ${rTableDel} WHERE parameter_id = ANY($1)`, [toDelete]);
      await client.query('DELETE FROM analysis_parameters WHERE id = ANY($1)', [toDelete]);
    }
  const paramIdMap = new Map();
  let insertedRangesTotal = 0;
  for (const p of incoming) {
      const name = p.name?.trim() || '';
      const unit = p.unit?.trim() || null;
      const position = p.position ?? null;
      const decimal = schema.pCols.has('decimal_places') ? (p.decimal_places ?? null) : null;
      if (!name) return next(new AppError(400,'Nombre de parámetro vacío','PARAM_NAME_REQUIRED'));
      if (p.id) {
        const sets = ['name=$1','unit=$2'];
        const vals = [name, unit];
        let idx = 3;
        if (schema.pCols.has('position')) { sets.push(`position=$${idx}`); vals.push(position); idx++; }
        if (schema.pCols.has('decimal_places')) { sets.push(`decimal_places=$${idx}`); vals.push(decimal); idx++; }
        vals.push(p.id, analysisId);
        await client.query(`UPDATE analysis_parameters SET ${sets.join(', ')} WHERE id=$${idx} AND analysis_id=$${idx+1}`, vals);
      } else {
        const cols = ['analysis_id','name','unit'];
        const ph = ['$1','$2','$3'];
        const vals = [analysisId, name, unit];
        let pos = 4;
        if (schema.pCols.has('position')) { cols.push('position'); ph.push(`$${pos}`); vals.push(position); pos++; }
        if (schema.pCols.has('decimal_places')) { cols.push('decimal_places'); ph.push(`$${pos}`); vals.push(decimal); pos++; }
        const { rows } = await client.query(`INSERT INTO analysis_parameters(${cols.join(',')}) VALUES(${ph.join(',')}) RETURNING id`, vals);
        paramIdMap.set(p, rows[0].id);
      }
    }
    // Second pass ranges (normalización & expansión backend)
    for (let pIndex=0; pIndex < incoming.length; pIndex++) {
      const p = incoming[pIndex];
      const paramId = p.id || paramIdMap.get(p); if (!paramId) continue;
      const hasValorProp = Object.prototype.hasOwnProperty.call(p,'valorReferencia') || Object.prototype.hasOwnProperty.call(p,'reference_ranges');
      const clearExplicit = p.clearRanges === true; // nueva bandera para permitir borrado intencional
      const rawRanges = Array.isArray(p.valorReferencia) ? p.valorReferencia : (Array.isArray(p.reference_ranges) ? p.reference_ranges : undefined);
      if (!hasValorProp && !clearExplicit) {
        // No se envió la propiedad => preservamos rangos existentes
        if (process.env.DEBUG_SYNC_RANGES === '1') {
          console.info(`[ANALYSIS][SYNC][${requestId}] preserve ranges paramId=${paramId} (no valorReferencia field)`);
        }
        continue;
      }
      if ((rawRanges === undefined || rawRanges === null) && !clearExplicit) {
        // Misma lógica de preservación defensiva
        if (process.env.DEBUG_SYNC_RANGES === '1') {
          console.info(`[ANALYSIS][SYNC][${requestId}] preserve ranges paramId=${paramId} (valorReferencia undefined/null)`);
        }
        continue;
      }
      if (Array.isArray(rawRanges) && rawRanges.length === 0 && !clearExplicit) {
        // Array vacío sin clearRanges explícito: asumimos que el frontend perdió estado y evitamos borrado accidental
        if (process.env.DEBUG_SYNC_RANGES === '1') {
          console.warn(`[ANALYSIS][SYNC][${requestId}] skip destructive empty ranges paramId=${paramId}`);
        }
        continue;
      }
      // Llegados aquí sí procedemos a reemplazar (borrado + inserción) porque:
      //  - hubo clearRanges explícito, o
      //  - hay un array con contenido
  const rTable = schema.modernRanges ? 'analysis_reference_ranges' : 'reference_ranges';
  await client.query(`DELETE FROM ${rTable} WHERE parameter_id=$1`, [paramId]);
      let rangesExpanded = [];
      try { rangesExpanded = expandAndValidateRanges(rawRanges); }
      catch(expErr){ await client.query('ROLLBACK'); if (expErr instanceof AppError) return next(expErr); return next(new AppError(400,'Error normalizando rangos','REFERENCE_RANGE_NORMALIZATION_FAIL',{ message: expErr.message })); }
      let insertedForParam = 0; // contador por parámetro
      for (let rIndex=0; rIndex < rangesExpanded.length; rIndex++) {
        const vr = rangesExpanded[rIndex];
        let sex = normalizeSex(vr.gender || vr.sexo || vr.sex || null);
        const age_min = vr.age_min ?? vr.edadMin ?? null;
        const age_max = vr.age_max ?? vr.edadMax ?? null;
        const age_min_unit = schema.rCols.has('age_min_unit') ? (vr.age_min_unit || vr.unidadEdad || null) : null;
        const lower = vr.lower ?? vr.valorMin ?? vr.normal_min ?? vr.min_value ?? null;
        const upper = vr.upper ?? vr.valorMax ?? vr.normal_max ?? vr.max_value ?? null;
        const text_value = schema.rCols.has('text_value') ? (vr.text_value || vr.textoPermitido || vr.textoLibre || null) : null;
        const notes = schema.rCols.has('notes') ? (vr.notes || vr.notas || null) : null;
        const unit = schema.rCols.has('unit') ? (vr.unit || vr.unidad || null) : null;
        if (lower != null && upper != null && Number(lower) > Number(upper)) {
          await client.query('ROLLBACK');
          return next(new AppError(400,`Rango inválido: lower > upper (${lower} > ${upper})`,'INVALID_RANGE_INTERVAL', { paramIndex: pIndex, rangeIndex: rIndex, lower, upper }));
        }
        if ((lower == null && upper == null && !text_value)) {
          // Evita insertar placeholders vacíos (por ejemplo los generados en cliente con notas "Sin referencia establecida")
          if (!notes || /sin referencia establecida/i.test(String(notes))) {
            continue;
          }
        }
        const bridgedSex = bridgeToLegacyIfNeeded(sex);
  const rTableIns = schema.modernRanges ? 'analysis_reference_ranges' : 'reference_ranges';
  const cols = ['parameter_id','sex','age_min','age_max'];
        const vals = [paramId, bridgedSex, age_min, age_max];
        if (schema.rCols.has('age_min_unit')) { cols.push('age_min_unit'); vals.push(age_min_unit); }
        if (schema.rCols.has('lower')) { cols.push('lower','upper'); vals.push(lower, upper); }
        else if (schema.rCols.has('min_value')) { cols.push('min_value','max_value'); vals.push(lower, upper); }
        if (schema.rCols.has('text_value')) { cols.push('text_value'); vals.push(text_value); }
        if (schema.rCols.has('notes')) { cols.push('notes'); vals.push(notes); }
        if (schema.rCols.has('unit')) { cols.push('unit'); vals.push(unit); }
        const ph = cols.map((_,i)=>'$'+(i+1));
        try {
          if (process.env.DEBUG_SEX_TOKENS === '1') {
            console.info('[ANALYSIS][SYNC][PRE-INSERT-RANGE]', { paramId, normalizedSex: sex, allowedSexTokens: schema.allowedSexTokens, rawSexInput: vr.gender||vr.sexo||vr.sex||null, cols, valsPreview: vals.slice(0,6) });
          }
          await client.query(`INSERT INTO ${rTableIns}(${cols.join(',')}) VALUES(${ph.join(',')})`, vals);
          insertedRangesTotal++;
          insertedForParam++;
        } catch(dbErr){
          const contextMeta = { paramId, sex, age_min, age_max, age_min_unit, lower, upper, text_value: text_value ? (text_value.slice(0,40)+'…') : null, paramIndex: pIndex, rangeIndex: rIndex };
          await client.query('ROLLBACK');
          if (dbErr.code === '23505') {
            console.warn(`[ANALYSIS][SYNC][${requestId}] Duplicado rango`, { ...contextMeta, detail: dbErr.detail });
            return next(new AppError(409,'Rango duplicado','DUPLICATE_REFERENCE_RANGE', contextMeta));
          }
          if (dbErr.code === '23514') {
            const allowed = (schema.allowedSexTokens || []).join(',');
            try { sexConstraintCache = null; await loadAnalysisSchema(req); } catch(refreshErr){ /* ignore */ }
            let liveConstraints = [];
            try {
              const { rows: crows } = await activePool(req).query(`SELECT c.conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON c.conrelid=t.oid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relname='reference_ranges' AND c.contype='c'`);
              liveConstraints = crows;
            } catch(errSnap){ liveConstraints = [{ error: 'snapshot_failed', message: errSnap.message }]; }
            const hexSex = typeof sex === 'string' ? Buffer.from(sex,'utf8').toString('hex') : null;
            const sexInputRaw = vr.gender||vr.sexo||vr.sex||null;
            const hexInputRaw = typeof sexInputRaw === 'string' ? Buffer.from(sexInputRaw,'utf8').toString('hex') : null;
            const dbDetail = dbErr.detail || null;
            const dbWhere = dbErr.where || null;
            console.warn(`[ANALYSIS][SYNC][${requestId}] Violación constraint sexo`, { constraint: dbErr.constraint, allowed, rawSexInput: vr.gender||vr.sexo||vr.sex||null, normalizedSex: sex, postRefreshAllowed: (sexConstraintCache?.tokens||[]).join(','), ...contextMeta });
            return next(new AppError(400,'Rango inválido (constraint)','REFERENCE_RANGE_CONSTRAINT_FAIL', { constraint: dbErr.constraint, allowed, postRefreshAllowed: (sexConstraintCache?.tokens||[]).join(','), rawSexInput: sexInputRaw, normalizedSex: sex, hexNormalizedSex: hexSex, hexRawSexInput: hexInputRaw, liveConstraints, dbDetail, dbWhere, legacyBridgeActive: !!(sexConstraintCache && sexConstraintCache.legacyPresent && !sexConstraintCache.canonicalPresent), ...contextMeta }));
          }
          console.error(`[ANALYSIS][SYNC][${requestId}] Error insert range`, dbErr, contextMeta);
          return next(new AppError(500,'Error insertando rango','REFERENCE_RANGE_INSERT_FAIL', contextMeta));
        }
      }
      // Fallback sintético: si se envió algún rango (rawRanges no vacío) pero todos fueron descartados por ser placeholders vacíos,
      // insertamos un único rango placeholder para preservar la existencia visible del parámetro.
      if (Array.isArray(rawRanges) && rawRanges.length > 0 && insertedForParam === 0) {
        try {
          const cols = ['parameter_id','sex','age_min','age_max'];
          const vals = [paramId, bridgeToLegacyIfNeeded(null), null, null];
          if (schema.rCols.has('age_min_unit')) { cols.push('age_min_unit'); vals.push(null); }
          if (schema.rCols.has('lower')) { cols.push('lower','upper'); vals.push(null, null); }
          else if (schema.rCols.has('min_value')) { cols.push('min_value','max_value'); vals.push(null, null); }
          if (schema.rCols.has('text_value')) { cols.push('text_value'); vals.push(null); }
          if (schema.rCols.has('notes')) { cols.push('notes'); vals.push('Sin referencia establecida'); }
          if (schema.rCols.has('unit')) { cols.push('unit'); vals.push(null); }
          const ph = cols.map((_,i)=>'$'+(i+1));
          const rTableIns2 = schema.modernRanges ? 'analysis_reference_ranges' : 'reference_ranges';
          await client.query(`INSERT INTO ${rTableIns2}(${cols.join(',')}) VALUES(${ph.join(',')})`, vals);
          insertedRangesTotal++;
          if (process.env.DEBUG_SYNC_RANGES === '1') {
            console.info(`[ANALYSIS][SYNC][${requestId}] inserted synthetic placeholder range paramId=${paramId}`);
          }
        } catch(synthErr) {
          console.warn(`[ANALYSIS][SYNC][${requestId}] failed synthetic placeholder insertion paramId=${paramId}`, synthErr.message);
        }
      }
    }
    const pSel = ['id','analysis_id','name','unit','created_at'];
    if (schema.pCols.has('position')) pSel.push('position');
    if (schema.pCols.has('decimal_places')) pSel.push('decimal_places');
    const { rows: fullParams } = await client.query(`SELECT ${pSel.join(', ')} FROM analysis_parameters WHERE analysis_id=$1 ORDER BY position NULLS LAST, created_at`, [analysisId]);
    const result = [];
    for (const p of fullParams) {
      const rSel = ['id','sex','age_min','age_max','created_at'];
      if (schema.rCols.has('age_min_unit')) rSel.push('age_min_unit');
      if (schema.rCols.has('lower')) { rSel.push('lower','upper'); }
      else if (schema.rCols.has('min_value')) { rSel.push('min_value','max_value'); }
      if (schema.rCols.has('text_value')) rSel.push('text_value');
      if (schema.rCols.has('notes')) rSel.push('notes');
      if (schema.rCols.has('unit')) rSel.push('unit');
  const rTableSel = schema.modernRanges ? 'analysis_reference_ranges' : 'reference_ranges';
  const { rows: rr } = await client.query(`SELECT ${rSel.join(', ')} FROM ${rTableSel} WHERE parameter_id=$1 ORDER BY created_at`, [p.id]);
      result.push(unifyParameter(p, schema, rr));
    }
    await client.query('COMMIT');
    console.info(`[ANALYSIS][SYNC][${requestId}] success params=${result.length} ranges=${insertedRangesTotal}`);
    res.json({ parameters: result, meta: { requestId, insertedRanges: insertedRangesTotal } });
  } catch(e){ await client.query('ROLLBACK'); console.error(`[ANALYSIS][SYNC][${analysisId}] FAIL`, e); next(new AppError(500,'Error sincronizando parámetros','ANALYSIS_PARAM_SYNC_FAIL')); }
  finally { client.release(); }
});

router.post('/', auth, requirePermission('studies','create'), audit('create','analysis', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req, res, next) => {
  try {
    const schema = await loadAnalysisSchema(req);
    if (!req.body.name) return next(new AppError(400,'name requerido','MISSING_FIELDS'));
    // Key handling when both columns (code & clave) might exist: prefer 'code' for NOT NULL/unique, mirror value to 'clave' if provided only once.
    const hasCode = schema.aCols.has('code');
    const hasClave = schema.aCols.has('clave');
    let providedKey = req.body.code || req.body.clave || null;
    if ((hasCode || hasClave) && !providedKey) return next(new AppError(400,'code/clave requerido','MISSING_FIELDS'));
    if (providedKey) {
      providedKey = String(providedKey).trim();
      if (!providedKey) return next(new AppError(400,'code/clave vacío','EMPTY_KEY'));
    }
    const insertCols = ['name']; const insertVals = [req.body.name];
    if (hasCode && hasClave && providedKey) {
      insertCols.push('code'); insertVals.push(providedKey);
      insertCols.push('clave'); insertVals.push(providedKey);
    } else if (hasCode && providedKey) { insertCols.push('code'); insertVals.push(providedKey); }
    else if (hasClave && providedKey) { insertCols.push('clave'); insertVals.push(providedKey); }
    ['category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price','active']
      .forEach(c=>{ if (schema.aCols.has(c) && Object.prototype.hasOwnProperty.call(req.body,c)) { insertCols.push(c); insertVals.push(req.body[c]); } });
    // Default active=true if column exists and not specified
    if (schema.aCols.has('active') && !insertCols.includes('active')) { insertCols.push('active'); insertVals.push(true); }
    const placeholders = insertCols.map((_,i)=>'$'+(i+1));
    const returning = ['id','name','created_at'];
    ['clave','code','category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price','active']
      .forEach(c=> schema.aCols.has(c) && returning.push(c));
    const { rows } = await activePool(req).query(`INSERT INTO analysis(${insertCols.join(',')}) VALUES(${placeholders.join(',')}) RETURNING ${returning.join(', ')}`, insertVals);
    const created = projectAnalysis(rows[0], schema);
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch(e){
    if (e && e.code === '23505') {
      // Unique violation (probablemente code duplicado)
      return next(new AppError(409,'Clave ya existente','DUPLICATE_KEY'));
    }
    console.error('[ANALYSIS][CREATE]', e);
    next(new AppError(500,'Error creando estudio','ANALYSIS_CREATE_FAIL'));
  }
});

router.get('/:id', auth, requirePermission('studies','read'), async (req, res, next) => {
  try {
    const schema = await loadAnalysisSchema(req);
    const select = ['id','name','created_at'];
    ['clave','code','category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price','active']
      .forEach(c=> schema.aCols.has(c) && select.push(c));
    const { rows } = await activePool(req).query(`SELECT ${select.join(', ')} FROM analysis WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return next(new AppError(404,'Estudio no encontrado','ANALYSIS_NOT_FOUND'));
    res.json(projectAnalysis(rows[0], schema));
  } catch(e){ console.error(e); next(new AppError(500,'Error obteniendo estudio','ANALYSIS_GET_FAIL')); }
});

router.put('/:id', auth, requirePermission('studies','update'), audit('update','analysis', req=>req.params.id, (req)=>({ body: req.body })), async (req, res, next) => {
  try {
    const schema = await loadAnalysisSchema(req);
    const sets = []; const vals = [];
    const hasCode = schema.aCols.has('code');
    const hasClave = schema.aCols.has('clave');
    const providedKey = req.body.code || req.body.clave;
    if (providedKey) {
      if (hasCode && hasClave) {
        sets.push(`code=$${sets.length+1}`); vals.push(providedKey);
        sets.push(`clave=$${sets.length+1}`); vals.push(providedKey);
      } else if (hasCode) { sets.push(`code=$${sets.length+1}`); vals.push(providedKey); }
      else if (hasClave) { sets.push(`clave=$${sets.length+1}`); vals.push(providedKey); }
    }
    ['name','category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price','active']
      .forEach(c=>{ if (schema.aCols.has(c) && Object.prototype.hasOwnProperty.call(req.body,c)) { sets.push(`${c}=$${sets.length+1}`); vals.push(req.body[c]); }});
    if (!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
    vals.push(req.params.id);
    const returning = ['id','name','created_at'];
    ['clave','code','category','description','indications','sample_type','sample_container','processing_time_hours','general_units','price','active']
      .forEach(c=> schema.aCols.has(c) && returning.push(c));
    const { rows } = await activePool(req).query(`UPDATE analysis SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING ${returning.join(', ')}`, vals);
    if (!rows[0]) return next(new AppError(404,'Estudio no encontrado','ANALYSIS_NOT_FOUND'));
    res.json(projectAnalysis(rows[0], schema));
  } catch(e){ console.error(e); next(new AppError(500,'Error actualizando estudio','ANALYSIS_UPDATE_FAIL')); }
});

router.delete('/:id', auth, requirePermission('studies','delete'), audit('delete','analysis', req=>req.params.id), async (req, res, next) => {
  try { const { rowCount } = await activePool(req).query('DELETE FROM analysis WHERE id=$1', [req.params.id]); if(!rowCount) return next(new AppError(404,'Estudio no encontrado','ANALYSIS_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando estudio','ANALYSIS_DELETE_FAIL')); }
});

router.get('/:id/parameters', auth, requirePermission('studies','read'), async (req,res)=>{
  try { const { rows } = await activePool(req).query('SELECT * FROM analysis_parameters WHERE analysis_id=$1 ORDER BY position NULLS LAST, created_at', [req.params.id]); res.json(rows); } catch(e){ console.error(e); res.status(500).json({ error:'Error listando parámetros'});} });

router.post('/:id/parameters', auth, requirePermission('studies','update'), audit('create','analysis_parameter', (req,r)=>r.locals?.paramId, (req)=>({ body: req.body, analysis_id: req.params.id })), async (req,res)=>{
  const { name, unit, position } = req.body || {};
  if(!name) return res.status(400).json({ error:'name requerido'});
  try {
    const { rows } = await activePool(req).query('INSERT INTO analysis_parameters(analysis_id,name,unit,position) VALUES($1,$2,$3,$4) RETURNING id, analysis_id, name, unit, position, created_at', [req.params.id,name,unit||null,position||null]);
    const created = { ...rows[0], decimal_places: null };
    res.locals.paramId = created.id; res.status(201).json(created);
  } catch(e){ console.error(e); res.status(500).json({ error:'Error creando parámetro'});} });

router.put('/parameters/:paramId', auth, requirePermission('studies','update'), audit('update','analysis_parameter', req=>req.params.paramId, (req)=>({ body: req.body })), async (req,res)=>{
  const fields=['name','unit','position']; const sets=[]; const vals=[]; fields.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); }}); if(!sets.length) return res.status(400).json({ error:'Nada para actualizar'}); vals.push(req.params.paramId); try { const { rows } = await activePool(req).query(`UPDATE analysis_parameters SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING id, analysis_id, name, unit, position, created_at`, vals); if(!rows[0]) return res.status(404).json({ error:'No encontrado'}); res.json({ ...rows[0], decimal_places: null }); } catch(e){ console.error(e); res.status(500).json({ error:'Error actualizando parámetro'});} });

router.delete('/parameters/:paramId', auth, requirePermission('studies','update'), audit('delete','analysis_parameter', req=>req.params.paramId), async (req,res)=>{
  const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
  try {
    // Return analysis_id so we can optionally refetch remaining parameters in one round trip
    const del = await activePool(req).query('DELETE FROM analysis_parameters WHERE id=$1 RETURNING analysis_id',[req.params.paramId]);
    if(!del.rowCount) return res.status(404).json({ error:'No encontrado'});
    if (!refresh) return res.status(204).send();
    const analysisId = del.rows[0].analysis_id;
    const schema = await loadAnalysisSchema(req);
    const cols = ['id','analysis_id','name','unit','created_at'];
    if (schema.pCols.has('position')) cols.push('position');
    if (schema.pCols.has('decimal_places')) cols.push('decimal_places');
    const { rows } = await activePool(req).query(`SELECT ${cols.join(', ')} FROM analysis_parameters WHERE analysis_id=$1 ORDER BY position NULLS LAST, created_at`, [analysisId]);
    res.json({ deleted: req.params.paramId, analysis_id: analysisId, parameters: rows.map(r => unifyParameter(r, schema, [])) });
  } catch(e){ console.error(e); res.status(500).json({ error:'Error eliminando parámetro'});} 
});

router.get('/parameters/:paramId/reference-ranges', auth, requirePermission('studies','read'), async (req,res)=>{
  try {
    const schema = await loadAnalysisSchema(req);
    const rTable = schema.modernRanges ? 'analysis_reference_ranges' : 'reference_ranges';
    const cols = ['id','sex','age_min','age_max','created_at'];
    if (schema.rCols.has('age_min_unit')) cols.push('age_min_unit');
    if (schema.rCols.has('lower')) cols.push('lower','upper'); else if (schema.rCols.has('min_value')) cols.push('min_value','max_value');
    if (schema.rCols.has('text_value')) cols.push('text_value');
    if (schema.rCols.has('notes')) cols.push('notes');
    if (schema.rCols.has('unit')) cols.push('unit');
    const { rows } = await activePool(req).query(`SELECT ${cols.join(', ')} FROM ${rTable} WHERE parameter_id=$1 ORDER BY created_at`, [req.params.paramId]);
    res.json(rows.map(r=>unifyRange(r, schema)));
  } catch(e){ console.error(e); res.status(500).json({ error:'Error listando rangos'});} });

router.post('/parameters/:paramId/reference-ranges', auth, requirePermission('studies','update'), audit('create','reference_range', (req,r)=>r.locals?.rangeId, (req)=>({ body: req.body, param_id: req.params.paramId })), async (req,res)=>{
  try {
    const body = req.body || {};
    const schema = await loadAnalysisSchema(req);
    const rTable = schema.modernRanges ? 'analysis_reference_ranges' : 'reference_ranges';
    let sex = normalizeSex(body.sex || body.gender || null);
    sex = bridgeToLegacyIfNeeded(sex);
    const age_min = body.age_min ?? body.edadMin ?? null;
    const age_max = body.age_max ?? body.edadMax ?? null;
    const age_min_unit = schema.rCols.has('age_min_unit') ? (body.age_min_unit || body.age_unit || body.unidadEdad || null) : null;
    const lower = body.lower ?? body.valorMin ?? body.min_value ?? null;
    const upper = body.upper ?? body.valorMax ?? body.max_value ?? null;
    const text_value = schema.rCols.has('text_value') ? (body.text_value || body.textoLibre || body.textoPermitido || null) : null;
    const notes = schema.rCols.has('notes') ? (body.notes || body.notas || null) : null;
    const unit = schema.rCols.has('unit') ? (body.unit || body.unidad || null) : null;
    if (lower!=null && upper!=null && Number(lower) > Number(upper)) return res.status(400).json({ error:'lower > upper'});
    if (lower==null && upper==null && !text_value && (!notes || /sin referencia establecida/i.test(String(notes)))) return res.status(400).json({ error:'Rango vacío'});
    const cols=['parameter_id','sex','age_min','age_max']; const vals=[req.params.paramId, sex, age_min, age_max];
    if (schema.rCols.has('age_min_unit')) { cols.push('age_min_unit'); vals.push(age_min_unit); }
    if (schema.rCols.has('lower')) { cols.push('lower','upper'); vals.push(lower, upper); } else if (schema.rCols.has('min_value')) { cols.push('min_value','max_value'); vals.push(lower, upper); }
    if (schema.rCols.has('text_value')) { cols.push('text_value'); vals.push(text_value); }
    if (schema.rCols.has('notes')) { cols.push('notes'); vals.push(notes); }
    if (schema.rCols.has('unit')) { cols.push('unit'); vals.push(unit); }
    const ph = cols.map((_,i)=>'$'+(i+1));
    const { rows } = await activePool(req).query(`INSERT INTO ${rTable}(${cols.join(',')}) VALUES(${ph.join(',')}) RETURNING *`, vals);
    const created = rows[0];
    res.locals.rangeId = created.id;
    res.status(201).json(unifyRange(created, schema));
  } catch(e){
    if (e.code === '23514') return res.status(400).json({ error:'constraint', detail:e.detail });
    console.error(e); res.status(500).json({ error:'Error creando rango'});
  }
});

router.put('/reference-ranges/:rangeId', auth, requirePermission('studies','update'), audit('update','reference_range', req=>req.params.rangeId, (req)=>({ body: req.body })), async (req,res)=>{
  await loadAnalysisSchema(req); // ensure schema cache ready (side effects)
  const map = { sex:'sex', age_min:'age_min', age_max:'age_max', unit:'unit', lower:'min_value', upper:'max_value', min_value:'min_value', max_value:'max_value' };
  const sets = []; const vals = [];
  Object.entries(map).forEach(([inKey,col])=>{ 
    if(Object.prototype.hasOwnProperty.call(req.body,inKey)){ 
      let value = req.body[inKey];
  if (inKey === 'sex') value = normalizeSex(value);
      sets.push(`${col}=$${sets.length+1}`); 
      vals.push(value); 
    }
  });
  if(!sets.length) return res.status(400).json({ error:'Nada para actualizar'});
  vals.push(req.params.rangeId);
  try {
    const { rows } = await activePool(req).query(`UPDATE reference_ranges SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING id, parameter_id, sex, age_min, age_max, unit, min_value, max_value, created_at`, vals);
    if(!rows[0]) return res.status(404).json({ error:'No encontrado'});
    const r = rows[0];
    res.json({ id: r.id, sex: r.sex, age_min: r.age_min, age_max: r.age_max, unit: r.unit, lower: r.min_value, upper: r.max_value });
  } catch(e){ console.error(e); res.status(500).json({ error:'Error actualizando rango'}); }
});

router.delete('/reference-ranges/:rangeId', auth, requirePermission('studies','update'), audit('delete','reference_range', req=>req.params.rangeId), async (req,res)=>{ try { const { rowCount } = await activePool(req).query('DELETE FROM reference_ranges WHERE id=$1',[req.params.rangeId]); if(!rowCount) return res.status(404).json({ error:'No encontrado'}); res.status(204).send(); } catch(e){ console.error(e); res.status(500).json({ error:'Error eliminando rango'}); } });

router.get('/catalog/stats', auth, requirePermission('studies','read'), async (req,res,next)=>{
  try {
    const db = activePool(req);
    // Determinar si existen columnas code/clave para construir SELECT seguro
    let hasCode = false; let hasClave = false;
    try {
      const { rows: cols } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='analysis' AND column_name IN ('code','clave')`);
      cols.forEach(r=>{ if (r.column_name==='code') hasCode=true; if (r.column_name==='clave') hasClave=true; });
    } catch(_) { /* fallback false */ }
    const keyExpr = hasCode && hasClave ? 'COALESCE(code, clave)' : (hasCode ? 'code' : (hasClave ? 'clave' : 'name'));
    const orderExpr = hasCode || hasClave ? keyExpr : 'name';
    const { rows: analyses } = await db.query(`SELECT id, name, ${keyExpr} AS key FROM analysis ORDER BY ${orderExpr}`);
    // Obtener todos los parámetros y rangos en bloques para evitar N+1
    const { rows: params } = await db.query(`SELECT id, analysis_id, name, unit, decimal_places FROM analysis_parameters ORDER BY analysis_id, position NULLS LAST, created_at`);
    // Determinar columnas de rangos (lower/upper vs min_value/max_value) de forma defensiva
    let rangeCols = 'id, parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, notes';
    try { await db.query('SELECT lower FROM reference_ranges LIMIT 0'); }
    catch(_) { rangeCols = 'id, parameter_id, sex, age_min, age_max, age_min_unit, min_value AS lower, max_value AS upper, notes'; }
    const { rows: ranges } = await db.query(`SELECT ${rangeCols} FROM reference_ranges ORDER BY parameter_id, created_at`);
    const rangesByParam = ranges.reduce((acc,r)=>{ (acc[r.parameter_id]=acc[r.parameter_id]||[]).push({ sex:r.sex, age_min:r.age_min, age_max:r.age_max, age_min_unit:r.age_min_unit, lower:r.lower, upper:r.upper, notes:r.notes }); return acc; },{});
    const paramsByAnalysis = params.reduce((acc,p)=>{ (acc[p.analysis_id]=acc[p.analysis_id]||[]).push({ name:p.name, unit:p.unit, decimal_places:p.decimal_places, ranges: rangesByParam[p.id]||[] }); return acc; },{});
    const items = analyses.map(a=>({ key: a.key, name: a.name, parameters: paramsByAnalysis[a.id]||[] }));
    const hash = hashCatalog({ items });
    const totalRanges = ranges.length;
    // Version actual (si existe la tabla)
    let version = null; let version_hash = null;
    try {
      const { rows: vrows } = await db.query('SELECT version_number, hash_sha256 FROM catalog_versions ORDER BY version_number DESC LIMIT 1');
      if (vrows[0]) { version = vrows[0].version_number; version_hash = vrows[0].hash_sha256; }
    } catch(_) { /* tabla puede no existir aún */ }
    res.json({ analysis_count: analyses.length, parameter_count: params.length, range_count: totalRanges, hash, current_version: version, current_version_hash: version_hash });
  } catch(e){ next(e); }
});

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

// Nuevo endpoint: generar UN solo parámetro IA para un estudio existente
