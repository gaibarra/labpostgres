const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

describe('Quotes smoke', () => {
  let token;

  beforeAll(async () => {
    token = await createAdminAndGetToken();
  });

  test('create/send/accept quote flow', async () => {
    const { rows } = await pool.query("SELECT to_regclass('public.quotes') AS exists");
    if (!rows[0]?.exists) return; // skip if migration not applied

    const refRes = await request(app)
      .post('/api/referrers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Referrer Quote ${Date.now()}`,
        entity_type: 'Medico',
        email: `ref_${Date.now()}@example.com`,
      });
    expect(refRes.status).toBe(201);

    let analysisId = null;
    const analysisList = await request(app)
      .get('/api/analysis?limit=1')
      .set('Authorization', `Bearer ${token}`);
    if (analysisList.status === 200 && analysisList.body?.data?.length) {
      analysisId = analysisList.body.data[0].id;
    } else {
      const analysisCreate = await request(app)
        .post('/api/analysis')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Quote Test Analysis', price: 120 });
      expect(analysisCreate.status).toBe(201);
      analysisId = analysisCreate.body.id;
    }

    const quoteRes = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        quote_number: `COT-${Date.now()}`,
        referring_entity_id: refRes.body.id,
        status: 'Borrador',
        items: [
          {
            item_type: 'study',
            item_id: analysisId,
            item_name: 'Quote Test Analysis',
            base_price: 120,
            discount_amount: 10,
            final_price: 110,
          }
        ]
      });
    expect(quoteRes.status).toBe(201);
    expect(quoteRes.body.items.length).toBe(1);

    const sendRes = await request(app)
      .post(`/api/quotes/${quoteRes.body.id}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'test' });
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.status).toBe('Enviada');

    const acceptRes = await request(app)
      .post(`/api/quotes/${quoteRes.body.id}/accept`)
      .set('Authorization', `Bearer ${token}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.status).toBe('Aceptada');

    const versionsRes = await request(app)
      .get(`/api/quotes/${quoteRes.body.id}/versions`)
      .set('Authorization', `Bearer ${token}`);
    expect(versionsRes.status).toBe(200);
    expect(Array.isArray(versionsRes.body.versions)).toBe(true);
  });
});
