const request = require('supertest');
const app = require('../index');

async function registerAndLogin(role = 'Administrador') {
  const email = `alias_${role}_${Date.now()}@test.local`;
  const password = 'Secret1234!';
  await request(app).post('/api/auth/register').send({ email, password, role });
  const login = await request(app).post('/api/auth/login').send({ email, password });
  return login.body.token;
}

describe('Config integrations no legacy alias', () => {
  test('GET /api/config nunca expone openAIKey', async () => {
  const adminToken = await registerAndLogin('Administrador');
    // Set secret con nueva clave
    const secretValue = 'sk-new-alias-test-1234567890';
  await request(app).patch('/api/config/integrations').set('Authorization', `Bearer ${adminToken}`).send({ openaiApiKey: secretValue });
  const res = await request(app).get('/api/config').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.integrations.openAIKey).toBeUndefined();
    // Asegurar preview presente
    expect(res.body.integrations.openaiApiKeyPreview).toBeDefined();
  });
});
