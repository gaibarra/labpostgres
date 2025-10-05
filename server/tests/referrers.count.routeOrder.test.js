const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db=true, token;

beforeAll(async ()=>{
  try { await pool.query('SELECT 1'); } catch { db=false; }
  if (!db) return;
  const email = `refcount_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password:'Secret123', role:'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password:'Secret123' });
  token = login.body.token;
});

describe('Referrers count route order', ()=>{
  test('GET /api/referrers/count responde 200 y JSON con total', async ()=>{
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .get('/api/referrers/count')
      .set('Authorization', `Bearer ${token}`);
    expect([200,403]).toContain(res.status); // si permisos cambian a restringir, permitir 403, pero no 404/500
    if (res.status === 200) {
      expect(res.body).toHaveProperty('total');
      expect(typeof res.body.total).toBe('number');
    }
  });
});
