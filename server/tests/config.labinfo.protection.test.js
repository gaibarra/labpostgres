const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken;

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  const adminEmail = `labinfo_protect_admin_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Protección labInfo (forceUnlock)', () => {
  test('PATCH labInfo sin forceUnlock devuelve 409 y no altera datos', async () => {
    if (!db) return expect(true).toBe(true);
    // Estado inicial: establecer name con forceUnlock primero
    const init = await request(app)
      .patch('/api/config?forceUnlock=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo: { name: 'Laboratorio Protegido' }, forceUnlock: true });
    expect(init.status).toBe(200);
    expect(init.body.labInfo.name).toBe('Laboratorio Protegido');

    // Intento sin forceUnlock
    const res = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo: { name: 'Cambio No Permitido' } });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('LABINFO_PROTECTED');

    // Confirmar que name no cambió
    const after = await request(app)
      .get('/api/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.status).toBe(200);
    expect(after.body.labInfo.name).toBe('Laboratorio Protegido');
  });

  test('PATCH labInfo con forceUnlock permite cambio', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .patch('/api/config?forceUnlock=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo: { phone: '555-9999' }, forceUnlock: true });
    expect(res.status).toBe(200);
    expect(res.body.labInfo.phone).toBe('555-9999');
  });

  test('PUT labInfo sin forceUnlock bloqueado', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .put('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo: { email: 'nuevo@lab.com' } });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('LABINFO_PROTECTED');
  });

  test('PUT labInfo con forceUnlock permite cambio', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .put('/api/config?forceUnlock=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo: { email: 'contacto@labprotegido.com' }, forceUnlock: true });
    expect(res.status).toBe(200);
    expect(res.body.labInfo.email).toBe('contacto@labprotegido.com');
  });
});
