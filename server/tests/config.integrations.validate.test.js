const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

// Helper para crear usuario admin y login
async function createAdminAndLogin(email='admin.validate@test.com'){
  await request(app).post('/api/auth/register').send({ email, password: 'Passw0rd!', name: 'Admin Val', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Passw0rd!' });
  return login.body.token;
}

describe('POST /api/config/integrations/validate', ()=>{
  test('valida formato openaiApiKey válido', async ()=>{
    const token = await createAdminAndLogin();
    const res = await request(app)
      .post('/api/config/integrations/validate?field=openaiApiKey')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'sk-ABCDEFGHIJKLMNOPQRSTUV1234' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  test('rechaza formato openaiApiKey inválido', async ()=>{
    const token = await createAdminAndLogin('admin.validate2@test.com');
    const res = await request(app)
      .post('/api/config/integrations/validate?field=openaiApiKey')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'bad-key' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});

afterAll(async ()=>{ await pool.end(); });
