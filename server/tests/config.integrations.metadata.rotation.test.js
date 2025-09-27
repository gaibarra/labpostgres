const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let adminToken; let db = true;

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  const email = `rotmeta_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Integrations secrets metadata rotation', () => {
  test('rotación y borrado multi-secreto (openaiApiKey y whatsappApiKey)', async () => {
    if (!db) return expect(true).toBe(true);

    // 1. Crear claves iniciales
    const firstOpenAI = 'sk-ROTATE-AAAA1111';
    const firstWhats = 'wa-ROTATE-ZZZZ9999';
    const setRes = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openaiApiKey: firstOpenAI, whatsappApiKey: firstWhats });
    expect(setRes.status).toBe(200);
    const meta1 = setRes.body._integrationsMeta || setRes.body.integrations?._meta;
    expect(meta1).toBeDefined();
    const openAIMeta1 = meta1.openaiApiKey || {};
    const whatsMeta1 = meta1.whatsappApiKey || {};
    expect(openAIMeta1.updatedAt).toBeDefined();
    expect(openAIMeta1.last4).toBe('1111');
    expect(whatsMeta1.updatedAt).toBeDefined();
    expect(whatsMeta1.last4).toBe('9999');

    // 2. Rotar sólo openaiApiKey
    const secondOpenAI = 'sk-ROTATE-BBBB2222';
    await new Promise(r => setTimeout(r, 12));
    const rotateRes = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openaiApiKey: secondOpenAI });
    expect(rotateRes.status).toBe(200);
    const meta2 = rotateRes.body._integrationsMeta || rotateRes.body.integrations?._meta;
    const openAIMeta2 = meta2.openaiApiKey || {};
    const whatsMeta2 = meta2.whatsappApiKey || {};
    expect(openAIMeta2.updatedAt).toBeDefined();
    expect(openAIMeta2.last4).toBe('2222');
    expect(openAIMeta2.updatedAt).not.toBe(openAIMeta1.updatedAt);
    // whatsapp no rotado
    expect(whatsMeta2.updatedAt).toBe(whatsMeta1.updatedAt);
    expect(whatsMeta2.removedAt).toBeUndefined();

    // 3. Borrar ambos
    await new Promise(r => setTimeout(r, 12));
    const delRes = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openaiApiKey: null, whatsappApiKey: null });
    expect(delRes.status).toBe(200);
    const meta3 = delRes.body._integrationsMeta || delRes.body.integrations?._meta;
    const openAIMeta3 = meta3.openaiApiKey || {};
    const whatsMeta3 = meta3.whatsappApiKey || {};
    expect(openAIMeta3.removedAt).toBeDefined();
    expect(whatsMeta3.removedAt).toBeDefined();
    expect(new Date(openAIMeta3.removedAt).getTime()).toBeGreaterThan(new Date(openAIMeta2.updatedAt).getTime());
  });
});
