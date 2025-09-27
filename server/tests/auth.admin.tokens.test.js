const request = require('supertest');
const app = require('../index');

async function createAdminAndLogin() {
  const email = `admin_${Date.now()}@test.local`;
  const password = 'Secret123!';
  // register normal
  await request(app).post('/api/auth/register').send({ email, password, role: 'Administrador' });
  // login
  const login = await request(app).post('/api/auth/login').send({ email, password });
  const token = login.body.token;
  return { token, email };
}

describe('Admin tokens endpoint', () => {
  test('Lista y revoca tokens activos', async () => {
    const { token } = await createAdminAndLogin();
    // List tokens
    const list = await request(app)
      .get('/api/auth/admin/tokens')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.tokens)).toBe(true);
    expect(list.body.tokens.length).toBeGreaterThan(0);
    const first = list.body.tokens[0];
    expect(first).toHaveProperty('jti');

    // Revoke first jti
    const revoke = await request(app)
      .post('/api/auth/admin/tokens/revoke')
      .set('Authorization', `Bearer ${token}`)
      .send({ jti: first.jti });
    expect(revoke.status).toBe(200);
    expect(revoke.body.revoked).toBe(true);
  });

  test('Usuario no admin recibe 403', async () => {
    const email = `user_${Date.now()}@test.local`;
    const password = 'Secret123!';
    await request(app).post('/api/auth/register').send({ email, password });
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const token = login.body.token;
    const list = await request(app)
      .get('/api/auth/admin/tokens')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(403);
  });
});
