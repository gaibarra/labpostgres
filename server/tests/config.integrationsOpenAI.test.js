const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let adminToken; let db=true;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db=false; }
  if (!db) return;
  const ts = Date.now();
  const email = `cfgint_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Config Integrations OpenAI persistence', ()=>{
  test('Set openaiApiKey via generic PATCH /config and retrieve via GET', async ()=>{
    if (!db) return expect(true).toBe(true);
    const patch = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ integrations: { openaiApiKey: 'sk-TEST-123' } });
    expect(patch.status).toBe(200);
    expect(patch.body.integrations.openaiApiKey).toBe('sk-TEST-123');
    const get = await request(app)
      .get('/api/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.integrations.openaiApiKey).toBe('sk-TEST-123');
  });
});
