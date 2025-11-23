const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

describe('Password reset endpoints', () => {
  let dbAvailable = true;

  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      dbAvailable = false;
      console.warn('[auth.password-reset.test] skipping tests, DB unavailable:', error.message);
    }
  });

  test('forgot-password creates token and reset-password updates credentials', async () => {
    if (!dbAvailable) return;
    const email = `pwreset_${Date.now()}@example.com`;
    const initialPassword = 'Secret123!';
    const newPassword = 'NuevaClave456!';

    const reg = await request(app).post('/api/auth/register').send({ email, password: initialPassword });
    expect(reg.statusCode).toBe(201);

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(forgot.statusCode).toBe(200);
    expect(forgot.body.success).toBe(true);
    expect(typeof forgot.body.previewToken === 'string').toBe(true);
    const token = forgot.body.previewToken;

    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: newPassword });
    expect(reset.statusCode).toBe(200);
    expect(reset.body.success).toBe(true);

    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: initialPassword });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ email, password: newPassword });
    expect(newLogin.statusCode).toBe(200);
    expect(newLogin.body?.user?.email).toBe(email);
  });

  test('authenticated password change requires valid current password', async () => {
    if (!dbAvailable) return;
    const email = `pwchange_${Date.now()}@example.com`;
    const originalPassword = 'Start123!';
    const updatedPassword = 'Better789!';

    const reg = await request(app).post('/api/auth/register').send({ email, password: originalPassword });
    expect(reg.statusCode).toBe(201);
    const token = reg.body.token;

    const fail = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass!', newPassword: updatedPassword });
    expect(fail.statusCode).toBe(401);

    const ok = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: originalPassword, newPassword: updatedPassword });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.success).toBe(true);

    const loginOld = await request(app).post('/api/auth/login').send({ email, password: originalPassword });
    expect(loginOld.statusCode).toBe(401);

    const loginNew = await request(app).post('/api/auth/login').send({ email, password: updatedPassword });
    expect(loginNew.statusCode).toBe(200);
  });
});
