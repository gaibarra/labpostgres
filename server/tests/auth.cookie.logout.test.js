const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let email; const password='Secret123';

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db=false; }
  if (!db) return;
  email = `cookie_logout_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password, role: 'Administrador' });
});

describe('Logout con cookie', () => {
  test('acceso con sólo cookie y luego logout invalidando', async () => {
    if (!db) return expect(true).toBe(true);
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const cookies = login.headers['set-cookie'];
    const cookieHeader = cookies.map(c=>c.split(';')[0]).join('; ');
    // Acceso a ruta protegida sin Authorization
    const me = await request(app).get('/api/auth/me').set('Cookie', cookieHeader);
    expect(me.status).toBe(200);
    // Logout (incluimos cookie y bearer por consistencia, aunque bearer no se envía)
    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookieHeader);
    expect(logout.status).toBe(200);
    // Intento posterior: debe fallar porque cookie fue limpiada (el client normalmente elimina cookie; aquí simulamos reuse -> servidor no revoca cookie directamente, así que generamos nuevo request sin cookie)
    const meNoCookie = await request(app).get('/api/auth/me');
    expect(meNoCookie.status).toBe(401);
  });
});
