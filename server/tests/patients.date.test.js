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

describe('Patient date_of_birth handling', () => {
  const postPatient = (body) => request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept','application/json')
    .send(body);

  test('inserta fecha exacta YYYY-MM-DD', async () => {
    if (!db) return expect(true).toBe(true);
    const body = { full_name: 'Test Paciente 1', date_of_birth: '1990-03-05' };
    const res = await postPatient(body);
    expect(res.status).toBe(201);
    expect(res.body.date_of_birth).toBe('1990-03-05');
  });

  test('normaliza fecha ISO con tiempo a YYYY-MM-DD', async () => {
    if (!db) return expect(true).toBe(true);
    const body = { full_name: 'Test Paciente 2', date_of_birth: '1990-03-05T10:15:30.000Z' };
    const res = await postPatient(body);
    expect(res.status).toBe(201);
    expect(res.body.date_of_birth).toBe('1990-03-05');
  });
});
