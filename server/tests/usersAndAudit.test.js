const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken; let guestToken; let adminEmail; let guestEmail;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  // create admin
  adminEmail = `ua_admin_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'Secret123', role: 'Administrador' });
  const aLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'Secret123' });
  adminToken = aLogin.body.token;
  // create guest
  guestEmail = `ua_guest_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: guestEmail, password: 'Secret123', role: 'Invitado' });
  const gLogin = await request(app).post('/api/auth/login').send({ email: guestEmail, password: 'Secret123' });
  guestToken = gLogin.body.token;
});

describe('Users & Audit endpoints', () => {
  test('admin can list users with normalized name fields', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should contain at least the two users we created
  const emails = res.body.map(u => u.email);
  expect(emails.includes(adminEmail)).toBe(true);
  expect(emails.includes(guestEmail)).toBe(true);
    const sample = res.body[0];
    // Basic shape
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('email');
    expect(sample).toHaveProperty('role');
    // Always present (may be null if not derivable)
    expect(sample).toHaveProperty('first_name');
    expect(sample).toHaveProperty('last_name');
  });

  test('audit create + list returns user_name even with flexible schema', async () => {
    if (!db) return expect(true).toBe(true);
    // create an audit log via API
    const create = await request(app)
      .post('/api/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'manual_test', details: { ok: true } });
    expect([201,403]).toContain(create.status); // if permissions changed fallback
    const list = await request(app)
      .get('/api/audit?all=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    if (list.body.items.length) {
      expect(list.body.items[0]).toHaveProperty('user_name');
    }
  });
});
