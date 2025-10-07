const request = require('supertest');
const app = require('..');

function authHeader(t){ return { Authorization: `Bearer ${t}` }; }

// Este test valida específicamente la persistencia de results y validation_notes
// incluyendo creación dinámica previa a la migración formal y después de ella.

describe('Work Orders results persistence', () => {
  let token;
  beforeAll(async () => {
    const email = `wo_results_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
    token = login.body.token;
  });

  test('create order with initial empty results and then update with values', async () => {
    // Obtener folio
    const folioRes = await request(app).get('/api/work-orders/next-folio').set(authHeader(token));
    const folio = folioRes.body.folio;

    const createPayload = {
      folio,
      status: 'Pendiente',
      selected_items: [],
      subtotal: 0,
      descuento: 0,
      anticipo: 0,
      total_price: 0,
      notas: 'Persist test',
      results: null,
      validation_notes: null
    };

    const created = await request(app)
      .post('/api/work-orders')
      .set(authHeader(token))
      .send(createPayload);

    expect(created.status).toBe(201);
    expect(created.body).toHaveProperty('id');
    expect(created.body).toHaveProperty('results');
    expect(created.body).toHaveProperty('validation_notes');

    const id = created.body.id;

    // Actualizar con un objeto results anidado simulando 2 estudios y 3 parámetros
    const resultsUpdate = {
      results: {
        'study-1': [ { parametroId: 'param-1', valor: '12.3' }, { parametroId: 'param-2', valor: '4.5' } ],
        'study-2': [ { parametroId: 'param-A', valor: null } ]
      },
      status: 'Procesando',
      validation_notes: 'Primera captura'
    };

    const updated = await request(app)
      .put(`/api/work-orders/${id}`)
      .set(authHeader(token))
      .send(resultsUpdate);

    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('Procesando');
    // Debe devolver results como objeto JSON
    expect(updated.body.results).toBeTruthy();
    expect(typeof updated.body.results).toBe('object');
    expect(updated.body.results['study-1']).toHaveLength(2);
    expect(updated.body.validation_notes).toBe('Primera captura');

    // Reconsumir GET para verificar persistencia real en DB
    const fetched = await request(app)
      .get(`/api/work-orders/${id}`)
      .set(authHeader(token));

    expect(fetched.status).toBe(200);
    expect(fetched.body.results['study-1']).toHaveLength(2);
    expect(fetched.body.results['study-2'][0].parametroId).toBe('param-A');
    expect(fetched.body.validation_notes).toBe('Primera captura');
  });

  test('partial update does not overwrite existing results (merge responsibility is client-side)', async () => {
    // Crear orden
    const folioRes = await request(app).get('/api/work-orders/next-folio').set(authHeader(token));
    const folio = folioRes.body.folio;
    const created = await request(app)
      .post('/api/work-orders')
      .set(authHeader(token))
      .send({ folio, status: 'Pendiente', selected_items: [], subtotal: 0, descuento: 0, anticipo: 0, total_price: 0, results: { 's1': [{ parametroId: 'p1', valor: '10' }] } });
    const id = created.body.id;

    // Partial update results for same study (client already merges, server overwrites field) -> expect full replacement
    const upd = await request(app)
      .put(`/api/work-orders/${id}`)
      .set(authHeader(token))
      .send({ results: { 's1': [{ parametroId: 'p1', valor: '11' }, { parametroId: 'p2', valor: '5' }] }, status: 'Procesando' });

    expect(upd.status).toBe(200);
    expect(upd.body.results['s1']).toHaveLength(2);
    expect(upd.body.results['s1'].find(r => r.parametroId === 'p1').valor).toBe('11');
  });
});
