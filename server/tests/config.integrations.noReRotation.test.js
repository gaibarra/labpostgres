const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let adminToken; let db = true;

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  const email = `norerot_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Integrations secrets no re-rotation when same key', () => {
  test('PATCH misma openaiApiKey no cambia updatedAt', async () => {
    if (!db) return expect(true).toBe(true);
    const key = 'sk-NO-REROT-0000AAAA';
    const first = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openaiApiKey: key });
    expect(first.status).toBe(200);
    const meta1 = first.body._integrationsMeta || first.body.integrations?._meta;
    const open1 = meta1.openaiApiKey; expect(open1).toBeDefined();
    expect(open1.updatedAt).toBeDefined();
    const updatedAt1 = open1.updatedAt; const last41 = open1.last4; const hash1 = open1.hash;
    await new Promise(r=>setTimeout(r,15));
    // Reenviar misma clave
    const second = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openaiApiKey: key });
    expect(second.status).toBe(200);
    const meta2 = second.body._integrationsMeta || second.body.integrations?._meta;
    const open2 = meta2.openaiApiKey; expect(open2).toBeDefined();
    expect(open2.updatedAt).toBe(updatedAt1); // no cambió
    expect(open2.last4).toBe(last41);
    expect(open2.hash).toBe(hash1);
  });
});
