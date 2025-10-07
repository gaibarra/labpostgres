import request from 'supertest';
import app from '../index.js';

// Este test valida que si enviamos un parámetro con únicamente rangos placeholder vacíos
// el backend inserta un rango sintético con notas "Sin referencia establecida".

describe('Reference Ranges Synthetic Placeholder Fallback', () => {
  let bearer;
  beforeAll(async () => {
    const email = `syn_${Date.now()}@example.com`;
    const reg = await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
    expect([200,201]).toContain(reg.status);
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
    expect(login.status).toBe(200);
    bearer = login.body.token;
  });

  test('inserta rango sintético cuando todos descartados', async () => {
    // Crear análisis base con código único para evitar 409 por duplicado
    const uniqueCode = 'LIP-PERF-' + Date.now();
    const createRes = await request(app).post('/api/analysis').set('Authorization', `Bearer ${bearer}`).send({ name: 'Perfil Lipídico', code: uniqueCode });
    expect([200,201]).toContain(createRes.status);
    const analysisId = createRes.body.id;

    // Sync con un parámetro que trae sólo placeholder vacíos (lower/upper null, nota estándar)
    const syncRes = await request(app)
      .post(`/api/analysis/${analysisId}/parameters-sync`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({
        parameters: [
          {
            name: 'Triglicéridos',
            unit: 'mg/dL',
            reference_ranges: [
              { notes: 'Sin referencia establecida', lower: null, upper: null, sex: null },
              { notes: 'Sin referencia establecida', lower: null, upper: null, sex: null }
            ]
          }
        ]
      });
    expect(syncRes.status).toBe(200);
    const param = syncRes.body.parameters.find(p => p.name === 'Triglicéridos');
    expect(param).toBeTruthy();
    // Debe haber exactamente 1 rango (el sintético)
    expect(param.reference_ranges || param.valorReferencia || []).toHaveLength(1);
    const rr = (param.reference_ranges || param.valorReferencia)[0];
    // Todos los campos numéricos nulos y nota estándar
    expect(rr.lower ?? rr.min_value ?? null).toBeNull();
    expect(rr.upper ?? rr.max_value ?? null).toBeNull();
    expect(/sin referencia establecida/i.test(rr.notes || '')).toBe(true);
  });
});
