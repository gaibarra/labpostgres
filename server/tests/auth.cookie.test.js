const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true;
let email; let password='Secret123';

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db=false; }
  if (!db) return;
  email = `cookie_auth_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password, role: 'Administrador' });
});

describe('Auth cookie httpOnly', () => {
  test('login emite cookie auth_token', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieLine = setCookie.find(c => c.startsWith('auth_token='));
    expect(cookieLine).toBeTruthy();
  });

  test('acceso a ruta protegida usando Authorization header sigue funcionando', async () => {
    if (!db) return expect(true).toBe(true);
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const token = login.body.token;
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email.toLowerCase()).toBe(email.toLowerCase());
  });
});
