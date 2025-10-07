const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysis(token){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const name = 'Estudio Detailed '+suffix;
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  const payload = { name };
  if (colSet.has('clave')) payload.clave = 'DT_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'DT_'+suffix.toUpperCase();
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('GET /api/analysis/detailed includes reference ranges', () => {
  test('detailed listing returns inserted range for parameter', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysis(token);
    const syncPayload = { parameters: [ { name:'Param Det', unit:'u', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:5, lower:1, upper:3 } ] } ] };
    const syncRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(syncPayload);
    expect(syncRes.status).toBe(200);
    const detRes = await request(app).get('/api/analysis/detailed?limit=5&offset=0').set('Authorization',`Bearer ${token}`);
    expect(detRes.status).toBe(200);
    const target = (detRes.body.data||[]).find(a=>a.id===analysisId);
    expect(target).toBeTruthy();
    expect(Array.isArray(target.parameters)).toBe(true);
    const p = target.parameters.find(p=>p.name==='Param Det');
    expect(p).toBeTruthy();
    expect(Array.isArray(p.reference_ranges)).toBe(true);
    expect(p.reference_ranges.length).toBeGreaterThan(0);
    const rr = p.reference_ranges[0];
    expect(rr.lower).toBe(1);
    expect(rr.upper).toBe(3);
  });
});

afterAll(async ()=>{ await pool.end(); });
