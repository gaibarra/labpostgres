const request = require('supertest');
const app = require('..');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

let db = true;
let token;

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  token = await createAdminAndGetToken();
});

describe('Patient date_of_birth invalid formats', () => {
  const attempt = (date_of_birth) => request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({ full_name: 'Paciente Invalido', date_of_birth });

  const cases = [
    '1990-13-01', // mes inválido
    '1990-00-10', // mes 00
    '1990-02-30', // día inválido para febrero
    '1990/01/01', // separadores incorrectos
    '19900305',   // sin guiones
  ];

  test.each(cases)('rechaza fecha inválida: %s', async (value) => {
    if (!db) return expect(true).toBe(true);
    const res = await attempt(value);
    expect(res.status).toBe(400);
    expect(res.body.code).toBeDefined();
  });

  test('permite null explícito (nullable)', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Paciente Null DOB', date_of_birth: null });
    // Según schema nullable debería aceptar y devolver null
    expect(res.status).toBe(201);
    expect(res.body.date_of_birth).toBeNull();
  });

  test('rechaza cadena vacía', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await attempt('');
    expect(res.status).toBe(400);
  });
});
