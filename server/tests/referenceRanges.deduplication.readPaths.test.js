const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysis(token, name){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const payload = { name: name + ' ' + suffix };
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  if (colSet.has('clave')) payload.clave = 'DG_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'DG_'+suffix.toUpperCase();
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  expect(res.status).toBe(201);
  return res.body.id;
}

async function getRangesTable(){
  const { rows } = await pool.query("SELECT to_regclass('public.analysis_reference_ranges') AS m, to_regclass('public.reference_ranges') AS l");
  return rows[0].m ? 'analysis_reference_ranges' : 'reference_ranges';
}

async function insertDuplicateRange(token, analysisId){
  // Crea parámetro con un rango y luego duplica la fila en BD a mano
  const syncPayload = { parameters: [ { name:'Param DEDUPE', unit:'u', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:5, lower:1, upper:3, notes:'t' } ] } ] };
  const syncRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(syncPayload);
  expect(syncRes.status).toBe(200);
  const p = syncRes.body.parameters.find(p=>p.name==='Param DEDUPE');
  expect(p).toBeTruthy();
  // Localiza la fila insertada para duplicarla
  const rTable = await getRangesTable();
  const { rows } = await pool.query(`SELECT * FROM ${rTable} WHERE parameter_id=$1 ORDER BY created_at`, [p.id]);
  expect(rows.length).toBeGreaterThan(0);
  const r = rows[0];
  const cols = ['parameter_id','sex','age_min','age_max'];
  const vals = [r.parameter_id, r.sex, r.age_min, r.age_max];
  if ('age_min_unit' in r) { cols.push('age_min_unit'); vals.push(r.age_min_unit); }
  if ('lower' in r) { cols.push('lower','upper'); vals.push(r.lower, r.upper); }
  else if ('min_value' in r) { cols.push('min_value','max_value'); vals.push(r.min_value, r.max_value); }
  if ('text_value' in r) { cols.push('text_value'); vals.push(r.text_value); }
  if ('notes' in r) { cols.push('notes'); vals.push(r.notes); }
  if ('unit' in r) { cols.push('unit'); vals.push(r.unit); }
  if ('method' in r) { cols.push('method'); vals.push(r.method); }
  const ph = cols.map((_,i)=>'$'+(i+1));
  try {
    await pool.query(`INSERT INTO ${rTable}(${cols.join(',')}) VALUES(${ph.join(',')})`, vals);
  } catch (err) {
    if (err.code !== '23505') throw err;
    // Índices únicos recientes pueden bloquear duplicados exactos; continuar para validar dedupe en lectura.
  }
  return { paramId: p.id };
}

describe('Deduplicación en lectura de rangos', () => {
  test('detailed y GET por parámetro no duplican filas idénticas', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysis(token, 'Estudio DEDUPE');
    const { paramId } = await insertDuplicateRange(token, analysisId);

    // /detailed
    const detRes = await request(app).get('/api/analysis/detailed?limit=10&offset=0').set('Authorization',`Bearer ${token}`);
    expect(detRes.status).toBe(200);
    const target = detRes.body.data.find(a=>a.id===analysisId);
    expect(target).toBeTruthy();
    const p = target.parameters.find(p=>p.id===paramId);
    expect(p).toBeTruthy();
  
    // Sólo 1 rango (el de datos; los placeholders pueden existir, pero dedupe afecta filas idénticas reales)
    const identical = p.reference_ranges.filter(rr=> rr.age_min===0 && rr.age_max===5 && rr.sex==='Ambos' && rr.lower===1 && rr.upper===3);
    expect(identical.length).toBe(1);

    // GET por parámetro
    const getRes = await request(app).get(`/api/analysis/parameters/${paramId}/reference-ranges`).set('Authorization',`Bearer ${token}`);
    expect(getRes.status).toBe(200);
  
    const identical2 = getRes.body.filter(rr=> rr.age_min===0 && rr.age_max===5 && rr.sex==='Ambos' && rr.lower===1 && rr.upper===3);
    expect(identical2.length).toBe(1);
  });
});

afterAll(async ()=>{ await pool.end(); });
