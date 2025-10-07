const request = require('supertest');
const app = require('../index');
const { createAdminAndGetToken } = require('./test-helpers');

/**
 * Verifica que rangos adyacentes (0-1 y 1-2) ya no disparan REFERENCE_RANGE_OVERLAP.
 */
describe('Reference Ranges Adjacency', () => {
  let token;
  beforeAll(async () => { token = await createAdminAndGetToken(); });

  it('allows adjacent ranges without overlap error', async () => {
    // Crear estudio mínimo
    const key = 'ADJ-'+Date.now();
    const createRes = await request(app)
      .post('/api/analysis')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Adjacency Test', code: key })
      .expect(201);
    const id = createRes.body.id;

    const payload = {
      parameters: [
        {
          name: 'Param A', unit: 'u', position: 1,
          valorReferencia: [
            { sex: 'Ambos', age_min: 0, age_max: 1, lower: 10, upper: 20 },
            { sex: 'Ambos', age_min: 1, age_max: 2, lower: 11, upper: 21 }
          ]
        }
      ]
    };

    const syncRes = await request(app)
      .post(`/api/analysis/${id}/parameters-sync`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(200);

    expect(syncRes.body).toHaveProperty('parameters');
    const p = syncRes.body.parameters[0];
    // Debe contener al menos los rangos expandido + placeholders (dependiendo de gap fill) sin error previo
    const serialized = p.reference_ranges.map(r=>[r.age_min,r.age_max]);
    // Aseguramos que los dos rangos originales existen (0-1) y (1-2)
    expect(serialized).toEqual(expect.arrayContaining([[0,1],[1,2]]));
  });
});
