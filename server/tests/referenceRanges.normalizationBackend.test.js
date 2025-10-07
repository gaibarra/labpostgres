const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysisWithToken(token){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const name = 'Estudio Ranges '+suffix;
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  const payload = { name };
  if (colSet.has('clave')) payload.clave = 'RNG_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'RNG_'+suffix.toUpperCase();
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  if (res.status !== 201) {
    // eslint-disable-next-line no-console
    console.error('Fallo createAnalysisWithToken', res.status, res.body);
  }
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('referenceRanges backend normalization', () => {
  test('fills gaps with Auto-fill gap placeholders (single sex)', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysisWithToken(token);
    const payload = {
      parameters: [
        {
          name: 'Parametro Gap', unit: 'u', position: 1, valorReferencia: [
            { sex: 'femenino', age_min: 0, age_max: 10, lower: 1, upper: 2 },
            { sex: 'Femenino', age_min: 20, age_max: 30, lower: 3, upper: 4 }
          ]
        }
      ]
    };
    const res = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(payload);
    expect(res.status).toBe(200);
    const param = res.body.parameters.find(p=>p.name==='Parametro Gap');
    expect(param).toBeTruthy();
    const ranges = param.reference_ranges.filter(r=>r.sex==='Femenino');
    // Debe haber: rango 0-10, placeholder 11-19, rango 20-30, placeholder 31-120 => total 4
    expect(ranges.length).toBe(4);
    const notesBySpan = ranges.reduce((acc,r)=>{ acc.push({ span:`${r.age_min}-${r.age_max}`, notes:r.notes||null, lower:r.lower, upper:r.upper }); return acc; }, []);
    const placeholder = notesBySpan.find(n=>n.notes==='Auto-fill gap' && n.span==='11-19');
    expect(placeholder).toBeTruthy();
  });

  test('rejects truly overlapping ranges (not just touching) with REFERENCE_RANGE_OVERLAP', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysisWithToken(token);
  // Segundo rango comienza antes de que termine el primero (age_min 9 < age_max 10) => solapado
  const payload = { parameters: [ { name: 'Parametro Overlap', unit: 'x', valorReferencia: [ { sex:'masculino', age_min:0, age_max:10, lower:1, upper:2 }, { sex:'Masculino', age_min:9, age_max:15, lower:2, upper:3 } ] } ] };
    const res = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(payload);
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('REFERENCE_RANGE_OVERLAP');
  });

  test('full-life null-null range produces no placeholders', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysisWithToken(token);
    const payload = { parameters: [ { name: 'Parametro Full', unit: 'k', valorReferencia: [ { sex:'ambos', age_min:null, age_max:null, lower:1, upper:2 } ] } ] };
    const res = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(payload);
    expect(res.status).toBe(200);
    const param = res.body.parameters.find(p=>p.name==='Parametro Full');
    const rr = param.reference_ranges;
    expect(rr.length).toBe(1); // sin placeholders
    expect(rr[0].age_min).toBe(null);
    expect(rr[0].age_max).toBe(null);
  });

  test('lowercase sex tokens normalize and expand coverage (masculino/femenino)', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysisWithToken(token);
    const payload = { parameters: [ { name: 'Parametro Sex Mix', unit: 'z', valorReferencia: [ { sex:'masculino', age_min:0, age_max:5, lower:1, upper:2 }, { sex:'femenino', age_min:0, age_max:5, lower:1, upper:2 } ] } ] };
    const res = await request(app).post(`/api/analysis/${analysisId}/parameters-sync`).set('Authorization',`Bearer ${token}`).send(payload);
    expect(res.status).toBe(200);
    const param = res.body.parameters.find(p=>p.name==='Parametro Sex Mix');
    const males = param.reference_ranges.filter(r=>r.sex==='Masculino');
    const females = param.reference_ranges.filter(r=>r.sex==='Femenino');
    // Para cada sexo: rango 0-5 + placeholder 6-120 => 2 cada uno
    expect(males.length).toBe(2);
    expect(females.length).toBe(2);
    const malePlaceholder = males.find(r=>r.notes==='Auto-fill gap' && r.age_min===6);
    expect(malePlaceholder).toBeTruthy();
  });
});

afterAll(async ()=>{ await pool.end(); });
