const request = require('supertest');
const app = require('../index');

// Helper para crear usuario y obtener token (el backend usa tokens en otros tests)
async function registerAndLogin(role = 'Administrador') {
  const email = `admin_${role}_${Date.now()}@test.local`;
  const password = 'Secret1234!';
  await request(app).post('/api/auth/register').send({ email, password, role });
  const login = await request(app).post('/api/auth/login').send({ email, password });
  const token = login.body.token; // consistente con otros tests
  return { token, email };
}

describe('GET /api/config/integrations admin endpoint', () => {
  test('admin ve secretos completos y metadata; no-admin 403', async () => {
  const { token: adminToken } = await registerAndLogin('Administrador');
    // Set secreto vía PATCH /integrations
    const secretValue = 'sk-admin-full-secret-1234567890';
    const patchRes = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openaiApiKey: secretValue });
    expect(patchRes.status).toBe(200);
    // Admin endpoint
    const adminGet = await request(app)
      .get('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminGet.status).toBe(200);
    expect(adminGet.body.integrations.openaiApiKey).toBe(secretValue);
    expect(adminGet.body.integrationsMeta.openaiApiKey).toBeDefined();
    // Crear usuario no admin
    const { token: userToken } = await registerAndLogin('Recepcion');
    const nonAdminGet = await request(app)
      .get('/api/config/integrations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(nonAdminGet.status).toBe(403);
  });
});
