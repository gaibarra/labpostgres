const request = require('supertest');
const app = require('../index');

// Este test verifica que tras logout el token cookie queda en blacklist y no puede reutilizarse

describe('Auth Cookie reuse after logout', () => {
  let server;
  beforeAll(() => { server = app; });

  test('No reutiliza cookie tras logout', async () => {
    const email = `reuse_cookie_${Date.now()}@test.local`;
    const password = 'Secret123!';

    // register
    const reg = await request(server).post('/api/auth/register').send({ email, password });
    expect(reg.status).toBe(201);

    // login (obtain cookie)
    const login = await request(server).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie']?.find(c=>c.startsWith('auth_token='));
    expect(cookie).toBeTruthy();

    // access protected with cookie
    const meOk = await request(server).get('/api/auth/me').set('Cookie', cookie);
    expect(meOk.status).toBe(200);

    // logout with cookie only
    const logout = await request(server).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);
    expect(logout.body.revoked).toBe(true);

    // try again with same cookie -> should be 401 due to blacklist
    const meAfter = await request(server).get('/api/auth/me').set('Cookie', cookie);
    expect(meAfter.status).toBe(401);
  });
});
