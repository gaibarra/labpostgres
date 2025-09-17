const request = require('supertest');
const app = require('..');

function auth(t){ return { Authorization: `Bearer ${t}` }; }

describe('Work Orders update & delete', () => {
  let token; let createdId;
  beforeAll(async () => {
    const email = `wo_ud_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
    token = login.body.token;
    const folioRes = await request(app).get('/api/work-orders/next-folio').set(auth(token));
    const create = await request(app).post('/api/work-orders').set(auth(token)).send({
      folio: folioRes.body.folio,
      status: 'draft',
      selected_items: [],
      subtotal: 0, descuento: 0, anticipo: 0, total_price: 0,
      notas: 'Inicial'
    });
    createdId = create.body.id;
  });

  test('update fields including financial + status', async () => {
    const upd = await request(app)
      .put(`/api/work-orders/${createdId}`)
      .set(auth(token))
      .send({ status: 'processing', subtotal: 150.50, descuento: 10, anticipo: 50, total_price: 190.50, notas: 'Actualizada', results_finalized: false });
    expect(upd.status).toBe(200);
    expect(upd.body.status).toBe('processing');
    expect(Number(upd.body.subtotal)).toBeCloseTo(150.50);
    expect(Number(upd.body.descuento)).toBeCloseTo(10);
    expect(Number(upd.body.anticipo)).toBeCloseTo(50);
    expect(Number(upd.body.total_price)).toBeCloseTo(190.50);
    expect(upd.body.notas).toBe('Actualizada');
  });

  test('finalize results then delete', async () => {
    const finalize = await request(app)
      .put(`/api/work-orders/${createdId}`)
      .set(auth(token))
      .send({ results_finalized: true, receipt_generated: true, validation_notes: 'OK' });
    expect(finalize.status).toBe(200);
    expect(finalize.body.results_finalized).toBe(true);
    expect(finalize.body.receipt_generated).toBe(true);
    const del = await request(app).delete(`/api/work-orders/${createdId}`).set(auth(token));
    expect(del.status).toBe(204);
    const getAfter = await request(app).get(`/api/work-orders/${createdId}`).set(auth(token));
    expect(getAfter.status).toBe(404);
  });
});
