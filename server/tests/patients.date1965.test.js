const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true;
let adminToken;

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  const email = `date1965_admin_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Paciente fecha de nacimiento 1965-01-03', () => {
  test('Crea y recupera sin desplazamiento', async () => {
    if (!db) return expect(true).toBe(true);
    const dob = '1965-01-03';
    const create = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Paciente 1965', date_of_birth: dob });
    expect(create.status).toBe(201);
    expect(create.body.date_of_birth).toBe(dob);

    const id = create.body.id;
    const get = await request(app)
      .get(`/api/patients/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.date_of_birth).toBe(dob);

    // Actualizar a otra fecha y volver
    const updateDob = '1965-01-02';
    const update = await request(app)
      .put(`/api/patients/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date_of_birth: updateDob });
    expect(update.status).toBe(200);
    expect(update.body.date_of_birth).toBe(updateDob);

    // Regresar a 1965-01-03
    const update2 = await request(app)
      .put(`/api/patients/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date_of_birth: dob });
    expect(update2.status).toBe(200);
    expect(update2.body.date_of_birth).toBe(dob);
  });
});
