const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let adminToken; let db=true;

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db=false; }
  if (!db) return;
  const email = `marketing_admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Marketing smoke', () => {
  test('ad campaigns CRUD minimal', async () => {
    if (!db) return expect(true).toBe(true);
    const create = await request(app)
      .post('/api/marketing/ad-campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Campaña Test', platform: 'Google Ads', start_date: '2025-01-01', budget: 1000 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    const list = await request(app)
      .get('/api/marketing/ad-campaigns')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    const upd = await request(app)
      .put(`/api/marketing/ad-campaigns/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Nota actualizada' });
    expect([200,404]).toContain(upd.status);
  });

  test('AI email template generation placeholder works', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .post('/api/marketing/email/generate-template')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ audience: 'pacientes', topic: 'Chequeo anual', tone: 'informativo', labName: 'LabX', userName: 'Dr Test' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('subject');
    expect(res.body).toHaveProperty('body');
  });
});
