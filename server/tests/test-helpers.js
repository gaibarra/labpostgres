const request = require('supertest');
const app = require('..');

/**
 * Crea un usuario administrador temporal y retorna su token Bearer.
 * Opcionalmente acepta un email fijo (para depuración) pero por defecto genera uno único.
 */
async function createAdminAndGetToken(opts = {}) {
  const { email = `admin_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`, password = 'Secret123' } = opts;
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password, role: 'Administrador' });
  if (registerRes.status !== 201 && registerRes.status !== 409) {
    throw new Error(`Fallo al registrar admin para test: status ${registerRes.status}`);
  }
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`Fallo al login admin para test: status ${loginRes.status}`);
  }
  return loginRes.body.token;
}

module.exports = { createAdminAndGetToken };
