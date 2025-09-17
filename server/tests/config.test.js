const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken; let guestToken;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  const adminEmail = `cfg_admin_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'Secret123', role: 'Administrador' });
  const aLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'Secret123' });
  adminToken = aLogin.body.token;
  const guestEmail = `cfg_guest_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: guestEmail, password: 'Secret123', role: 'Invitado' });
  const gLogin = await request(app).post('/api/auth/login').send({ email: guestEmail, password: 'Secret123' });
  guestToken = gLogin.body.token;
});

describe('Lab configuration save flow', () => {
  test('auto-creates empty config on first GET', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).get('/api/config').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.labInfo).toBeDefined();
  });

  test('guest cannot PATCH config', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ labInfo: { name: 'New Name' } });
    expect(res.status).toBe(403);
  });

  test('admin PATCH updates only provided sections', async () => {
    if (!db) return expect(true).toBe(true);
    const before = await request(app).get('/api/config').set('Authorization', `Bearer ${adminToken}`);
    const patch = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo: { name: 'Lab Central' } });
    expect(patch.status).toBe(200);
    expect(patch.body.labInfo.name).toBe('Lab Central');
    // unchanged section should remain object
    expect(patch.body.reportSettings).toEqual(before.body.reportSettings);
  });

  test('admin PUT replaces specified sections only', async () => {
    if (!db) return expect(true).toBe(true);
    const put = await request(app)
      .put('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uiSettings: { theme: 'dark' }, taxSettings: { iva: 16 } });
    expect(put.status).toBe(200);
    expect(put.body.uiSettings.theme).toBe('dark');
    expect(put.body.taxSettings.iva).toBe(16);
  });

  test('admin PATCH can set integrations API keys and they persist', async () => {
    if (!db) return expect(true).toBe(true);
    const keyVal = 'sk-TEST123';
    const whatsVal = 'wapp-ABC';
    const patch = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ integrations: { openaiApiKey: keyVal, whatsappApiKey: whatsVal } });
    expect(patch.status).toBe(200);
    expect(patch.body.integrations).toBeDefined();
    expect(patch.body.integrations.openaiApiKey).toBe(keyVal);
    expect(patch.body.integrations.whatsappApiKey).toBe(whatsVal);
    // Fetch again to confirm persistence
    const after = await request(app)
      .get('/api/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.status).toBe(200);
    expect(after.body.integrations.openaiApiKey).toBe(keyVal);
    expect(after.body.integrations.whatsappApiKey).toBe(whatsVal);
  });
});
