const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysis(token){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const name = 'Biometría Hemática '+suffix;
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  const payload = { name };
  if (colSet.has('clave')) payload.clave = 'BH_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'BH_'+suffix.toUpperCase();
  if (colSet.has('category')) payload.category = 'Biometría Hemática';
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('Biometría Hemática integrity non destructive sync', () => {
  test('preserves ranges for multiple hematology parameters on partial sync', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysis(token);
    const seedParams = [
      { name:'VCM', unit:'fL', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:120, lower:80, upper:96 } ] },
      { name:'HCM', unit:'pg', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:120, lower:27, upper:33 } ] },
      { name:'Hemoglobina', unit:'g/dL', valorReferencia: [ { sex:'Masculino', age_min:0, age_max:120, lower:13, upper:17 }, { sex:'Femenino', age_min:0, age_max:120, lower:12, upper:16 } ] }
    ];
    const firstPayload = { parameters: seedParams };
    const firstRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(firstPayload);
    expect(firstRes.status).toBe(200);
    // Mapear IDs
    const mapped = {};
    for (const p of firstRes.body.parameters) {
      mapped[p.name] = p.id;
      expect(p.reference_ranges.length).toBeGreaterThan(0);
    }
    // Segundo sync: solo actualizamos nombre de uno, omitimos valorReferencia en todos
    const secondPayload = { parameters: [ { id: mapped['VCM'], name:'VCM', unit:'fL' }, { id: mapped['HCM'], name:'HCM', unit:'pg' }, { id: mapped['Hemoglobina'], name:'Hemoglobina', unit:'g/dL' } ] };
    const secondRes = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(secondPayload);
    expect(secondRes.status).toBe(200);
    for (const p of secondRes.body.parameters) {
      if (['VCM','HCM','Hemoglobina'].includes(p.name)) {
        expect(p.reference_ranges.length).toBeGreaterThan(0);
      }
    }
  });
});

afterAll(async ()=>{ await pool.end(); });
