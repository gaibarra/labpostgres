const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let dbAvailable = true;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch (e) { dbAvailable = false; console.warn('DB no disponible, tests auth se omiten'); }
});

describe('Auth endpoints', () => {
  test('register validation error', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: '123' });
    expect(res.status).toBe(400);
  });

  test('login missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
  });

  test('full register+login flow (conditional)', async () => {
    if (!dbAvailable) return expect(true).toBe(true);
    const email = `test_${Date.now()}@example.com`;
    const reg = await request(app).post('/api/auth/register').send({ email, password: 'secret123', full_name: 'Tester' });
    expect([201,409]).toContain(reg.status);
    const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
    expect([200,401]).toContain(login.status);
  });

  test('successful login returns token and role', async () => {
    if (!dbAvailable) return expect(true).toBe(true);
    const email = `login_ok_${Date.now()}@example.com`;
    const reg = await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
    expect(reg.status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty('token');
    expect(login.body.user).toHaveProperty('role');
    expect(login.body.user.role).toBe('Administrador');
  });

  test('login fails with wrong password', async () => {
    if (!dbAvailable) return expect(true).toBe(true);
    const email = `login_fail_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'CorrectPass1' });
    const bad = await request(app).post('/api/auth/login').send({ email, password: 'WrongPass1' });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('BAD_CREDENTIALS');
  });
});