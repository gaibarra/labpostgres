const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysis(token){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const name = 'Estudio Sync ND '+suffix;
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  const payload = { name };
  if (colSet.has('clave')) payload.clave = 'ND_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'ND_'+suffix.toUpperCase();
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('referenceRanges non destructive sync safeguard', () => {
  test('second sync omitting valorReferencia preserves existing ranges', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysis(token);
    const firstPayload = { parameters: [ { name:'Param Preserve', unit:'u', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:10, lower:1, upper:2 } ] } ] };
    const firstRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(firstPayload);
    expect(firstRes.status).toBe(200);
    const param = firstRes.body.parameters.find(p=>p.name==='Param Preserve');
    const initialCount = param.reference_ranges.length;
    expect(initialCount).toBeGreaterThan(0);
    // Segundo sync SIN la propiedad valorReferencia
    const secondPayload = { parameters: [ { id: param.id, name:'Param Preserve', unit:'u' } ] };
    const secondRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(secondPayload);
    expect(secondRes.status).toBe(200);
    const paramAfter = secondRes.body.parameters.find(p=>p.id===param.id);
    expect(paramAfter.reference_ranges.length).toBe(initialCount);
  });

  test('second sync with empty array is ignored (preserved) unless clearRanges=true', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysis(token);
    const firstPayload = { parameters: [ { name:'Param Empty Ignore', unit:'u', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:5, lower:1, upper:2 } ] } ] };
    const firstRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(firstPayload);
    expect(firstRes.status).toBe(200);
    const param = firstRes.body.parameters.find(p=>p.name==='Param Empty Ignore');
    const initialCount = param.reference_ranges.length;
    // Sync con array vacío (debe preservar)
    const secondPayload = { parameters: [ { id:param.id, name:'Param Empty Ignore', unit:'u', valorReferencia: [] } ] };
    const secondRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(secondPayload);
    expect(secondRes.status).toBe(200);
    const after = secondRes.body.parameters.find(p=>p.id===param.id);
    expect(after.reference_ranges.length).toBe(initialCount);
    // Sync con clearRanges explícito debe borrar
    const thirdPayload = { parameters: [ { id:param.id, name:'Param Empty Ignore', unit:'u', valorReferencia: [], clearRanges: true } ] };
    const thirdRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(thirdPayload);
    expect(thirdRes.status).toBe(200);
    const afterClear = thirdRes.body.parameters.find(p=>p.id===param.id);
    expect(afterClear.reference_ranges.length).toBe(0);
  });
});

afterAll(async ()=>{ await pool.end(); });
