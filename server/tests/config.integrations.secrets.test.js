const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let adminToken; let db = true;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  const email = `cfgsec_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Integrations secrets behavior (openaiApiKey)', () => {
  test('Preserva openaiApiKey si PATCH sin campo y permite borrado con null', async () => {
    if (!db) return expect(true).toBe(true);
    // 1. Set initial key
    const setRes = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openaiApiKey: 'sk-PERSIST-1111' });
    expect(setRes.status).toBe(200);
    expect(setRes.body.integrations.openaiApiKey).toBe('sk-PERSIST-1111');

    // 2. Generic PATCH without integrations (should not remove)
    const patchNoIntegrations = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uiSettings: { theme: 'light' } });
    expect(patchNoIntegrations.status).toBe(200);
    expect(patchNoIntegrations.body.integrations.openaiApiKey).toBe('sk-PERSIST-1111');

    // 3. PATCH with integrations but without openaiApiKey field (should preserve)
    const patchIntegrationsNoKey = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ integrations: { whatsappApiKey: 'wapp-2222' } });
    expect(patchIntegrationsNoKey.status).toBe(200);
    expect(patchIntegrationsNoKey.body.integrations.openaiApiKey).toBe('sk-PERSIST-1111');
    expect(patchIntegrationsNoKey.body.integrations.whatsappApiKey).toBe('wapp-2222');

    // 4. Explicit deletion with null
    const deleteKey = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ integrations: { openaiApiKey: null } });
    expect(deleteKey.status).toBe(200);
    expect(deleteKey.body.integrations.openaiApiKey).toBeNull();

    // 5. GET confirms deletion
    const getAfter = await request(app)
      .get('/api/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getAfter.status).toBe(200);
    // Ahora en GET las claves de secreto eliminadas se omiten (no quedan como null)
    expect('openaiApiKey' in getAfter.body.integrations).toBe(false);
    // Metadatos: debe existir registro de removedAt en _meta
    expect(getAfter.body.integrations._meta).toBeDefined();
    expect(getAfter.body.integrations._meta.openaiApiKey).toBeDefined();
    expect(getAfter.body.integrations._meta.openaiApiKey.removedAt).toBeDefined();
  });
});
