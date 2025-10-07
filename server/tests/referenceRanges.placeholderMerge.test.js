const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysis(token){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const name = 'Estudio Merge '+suffix;
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  const payload = { name };
  if (colSet.has('clave')) payload.clave = 'MRG_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'MRG_'+suffix.toUpperCase();
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('referenceRanges placeholder merge', () => {
  test('merges contained placeholder (0-1) into broader real range (0-17)', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysis(token);
    const payload = {
      parameters: [
        {
          name: 'Triglicéridos', unit: 'mg/dL', valorReferencia: [
            { sex: 'Ambos', age_min: 0, age_max: 1, lower: null, upper: null, notes: 'Sin referencia establecida' },
            { sex: 'Ambos', age_min: 0, age_max: 17, lower: 50, upper: 150 }
          ]
        }
      ]
    };
    const res = await request(app)
      .post(`/api/analysis/${analysisId}/parameters-sync`)
      .set('Authorization',`Bearer ${token}`)
      .send(payload);
    expect(res.status).toBe(200);
    const param = res.body.parameters.find(p=>p.name==='Triglicéridos');
    expect(param).toBeTruthy();
    const ranges = param.reference_ranges.filter(r=>r.sex==='Ambos');
    // Esperamos que el placeholder 0-1 se haya fusionado y quede el rango 0-17 con datos + placeholder gap 18-120
    expect(ranges.length).toBe(2);
    const first = ranges.find(r=>r.age_min===0 && r.age_max===17);
    expect(first).toBeTruthy();
    expect(first.lower).toBe(50);
    expect(first.upper).toBe(150);
    const gap = ranges.find(r=>r.age_min===18 && r.age_max===120 && r.notes==='Auto-fill gap');
    expect(gap).toBeTruthy();
  });
});

afterAll(async ()=>{ await pool.end(); });
