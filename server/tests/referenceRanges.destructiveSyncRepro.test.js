const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysisWithToken(token){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const name = 'Estudio Sync Destructivo '+suffix;
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  const payload = { name };
  if (colSet.has('clave')) payload.clave = 'DS_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'DS_'+suffix.toUpperCase();
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('referenceRanges legacy destructive sync reproduction (now preserved)', () => {
  test('second sync with empty valorReferencia array now preserves previously stored ranges', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysisWithToken(token);
    // Primer sync con un parámetro y un rango simple
    const firstPayload = { parameters: [ { name:'Param A', unit:'u', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:10, lower:1, upper:2 } ] } ] };
    const firstRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(firstPayload);
    expect(firstRes.status).toBe(200);
  const param = firstRes.body.parameters.find(p=>p.name==='Param A');
  const initialCount = param.reference_ranges.length;
  expect(initialCount).toBeGreaterThan(0);
  const paramId = param.id;
    // Segundo sync enviando mismo parámetro (con id) pero valorReferencia: []
    const secondPayload = { parameters: [ { id: paramId, name:'Param A', unit:'u', valorReferencia: [] } ] };
    const secondRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(secondPayload);
    expect(secondRes.status).toBe(200);
    const paramAfter = secondRes.body.parameters.find(p=>p.id===paramId);
    // Nuevo comportamiento: preserva los rangos (no se vacía al mandar array vacío sin clearRanges)
    expect(paramAfter.reference_ranges.length).toBe(initialCount);
  });
});

afterAll(async ()=>{ await pool.end(); });
