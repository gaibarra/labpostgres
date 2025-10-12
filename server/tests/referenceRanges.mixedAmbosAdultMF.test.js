const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysis(token){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const name = 'Estudio Mixto Ambos+MF '+suffix;
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  const payload = { name };
  if (colSet.has('clave')) payload.clave = 'MIX_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'MIX_'+suffix.toUpperCase();
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('Reference Ranges mezcla Ambos pediátrico + Adulto M/F', () => {
  test('preserva 0-17 Ambos y 18-120 M/F sin placeholders en modo mixto', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysis(token);
    const payload = {
      parameters: [
        {
          name: 'BH Mix', unit: 'u', valorReferencia: [
            { sex: 'Ambos', age_min: 0, age_max: 17, lower: 10, upper: 20 },
            { sex: 'Masculino', age_min: 18, age_max: 120, lower: 12, upper: 22 },
            { sex: 'Femenino', age_min: 18, age_max: 120, lower: 11, upper: 21 }
          ]
        }
      ]
    };
    const res = await request(app)
      .post(`/api/analysis/${analysisId}/parameters-sync`)
      .set('Authorization',`Bearer ${token}`)
      .send(payload);
    expect(res.status).toBe(200);

    const param = res.body.parameters.find(p=>p.name==='BH Mix');
    expect(param).toBeTruthy();
    const rr = param.reference_ranges;
    const ambos = rr.filter(r=>r.sex==='Ambos');
    const males = rr.filter(r=>r.sex==='Masculino');
    const females = rr.filter(r=>r.sex==='Femenino');

    // Escenario mixto: sin placeholders automáticos
    // Ambos sólo conserva el tramo pediátrico no solapado con M/F
    expect(ambos.length).toBe(1);
    const pedi = ambos[0];
    expect(pedi.age_min).toBe(0);
    expect(pedi.age_max).toBe(17);
    expect(pedi.lower).toBe(10);
    expect(pedi.upper).toBe(20);
    expect(pedi.notes || null).toBeNull();

    // Adultos M/F deben existir únicamente en 18-120 sin generar tramos huecos
    expect(males.length).toBe(1);
    expect(males[0].age_min).toBe(18);
    expect(males[0].age_max).toBe(120);
    expect(males[0].notes || null).toBeNull();
    expect(males[0].lower).toBe(12);
    expect(males[0].upper).toBe(22);

    expect(females.length).toBe(1);
    expect(females[0].age_min).toBe(18);
    expect(females[0].age_max).toBe(120);
    expect(females[0].notes || null).toBeNull();
    expect(females[0].lower).toBe(11);
    expect(females[0].upper).toBe(21);

    // Aseguramos que no hay placeholders (notes==='Auto-fill gap') en ningún sexo
    const anyPlaceholder = rr.some(r => r.notes === 'Auto-fill gap');
    expect(anyPlaceholder).toBe(false);
  });
});

afterAll(async ()=>{ await pool.end(); });
