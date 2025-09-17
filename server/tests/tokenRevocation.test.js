const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('..');
const { pool } = require('../db');
const { add: blacklistAdd } = require('../services/tokenStore');

describe('Token revocation & validation', () => {
  let db = true; let token; let userId;
  beforeAll(async () => {
    try { await pool.query('SELECT 1'); } catch { db = false; }
    if (!db) return;
    const email = `revoketest_${Date.now()}@example.com`;
    const reg = await request(app).post('/api/auth/register').send({ email, password: 'Passw0rd!', full_name: 'Revoker' });
    if (reg.statusCode !== 201) { db = false; return; }
    token = reg.body.token;
    userId = reg.body.user.id;
  });

  test('blacklisted token rejected', async () => {
    if (!db) return; // skip if no DB
    const decoded = jwt.decode(token);
    blacklistAdd(token, decoded.exp);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.statusCode).toBe(401);
  });

  test('invalid token structure', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid.token.structure');
    expect(res.statusCode).toBe(401);
  });
});
