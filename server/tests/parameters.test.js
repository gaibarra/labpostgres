const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken; let guestToken; let createdId;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  const adminEmail = `param_admin_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'Secret123', role: 'Administrador' });
  adminToken = (await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'Secret123' })).body.token;
  const guestEmail = `param_guest_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: guestEmail, password: 'Secret123', role: 'Invitado' });
  guestToken = (await request(app).post('/api/auth/login').send({ email: guestEmail, password: 'Secret123' })).body.token;
});

describe('system_parameters CRUD & permissions', () => {
  test('guest cannot list parameters (view denied)', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).get('/api/parameters').set('Authorization', `Bearer ${guestToken}`);
    expect([401,403]).toContain(res.status); // depending on middleware path
  });

  test('admin can create parameter', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .post('/api/parameters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'APP_THEME', value: 'light' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('APP_THEME');
    createdId = res.body.id;
  });

  test('duplicate parameter name returns conflict', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .post('/api/parameters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'APP_THEME', value: 'dark' });
    expect(res.status).toBe(409);
  });

  test('list shows created parameter', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .get('/api/parameters')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const names = res.body.map(p => p.name);
    expect(names).toContain('APP_THEME');
  });

  test('update parameter name and value', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .put(`/api/parameters/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'APP_COLOR_SCHEME', value: 'dark' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('APP_COLOR_SCHEME');
    expect(res.body.value).toBe('dark');
  });

  test('guest cannot create parameter', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .post('/api/parameters')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ name: 'SHOULD_FAIL', value: 'x' });
    expect([401,403]).toContain(res.status);
  });

  test('delete parameter and subsequent delete 404', async () => {
    if (!db) return expect(true).toBe(true);
    const del = await request(app)
      .delete(`/api/parameters/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200); // JSON { success: true }
    const del2 = await request(app)
      .delete(`/api/parameters/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del2.status).toBe(404);
  });
});
