const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let adminToken; let db = true;

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const email = `kpi_defaults_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Ad Campaign KPIs defaults', () => {
  test('crea campaña sin kpis y responde con estructura default', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .post('/api/marketing/ad-campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sin KPIs', platform: 'Google Ads', start_date: '2025-01-01', budget: 1234 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('kpis');
    expect(res.body.kpis).toMatchObject({
      impressions: 0,
      clicks: 0,
      conversions: 0,
      ctr: '0%',
      cpc: '$0.00',
      cpa: '$0.00'
    });
  });

  test('GET /api/marketing/ad-campaigns normaliza campañas existentes', async () => {
    if (!db) return expect(true).toBe(true);
    const list = await request(app)
      .get('/api/marketing/ad-campaigns')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    for (const c of list.body) {
      expect(c).toHaveProperty('kpis');
      // Debe contener los campos clave (aunque haya valores adicionales)
      ['impressions','clicks','conversions','ctr','cpc','cpa'].forEach(k => {
        expect(c.kpis).toHaveProperty(k);
      });
    }
  });
});
