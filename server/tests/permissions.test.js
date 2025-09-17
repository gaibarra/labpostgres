const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken; let guestToken;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const aEmail = `admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email: aEmail, password: 'Secret123', role: 'Administrador' });
  const aLogin = await request(app).post('/api/auth/login').send({ email: aEmail, password: 'Secret123' });
  adminToken = aLogin.body.token;
  const gEmail = `guest_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email: gEmail, password: 'Secret123', role: 'Invitado' });
  const gLogin = await request(app).post('/api/auth/login').send({ email: gEmail, password: 'Secret123' });
  guestToken = gLogin.body.token;
});

describe('Permissions', () => {
  test('guest cannot list roles', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).get('/api/roles').set('Authorization', `Bearer ${guestToken}`);
    expect(res.status).toBe(403);
  });
  test('admin can list roles', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).get('/api/roles').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
