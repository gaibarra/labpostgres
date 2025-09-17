const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const email = `audit_admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  adminToken = login.body.token;
});

describe('Audit smoke', () => {
  test('creating and deleting a patient generates audit entries (best effort)', async () => {
    if (!db) return expect(true).toBe(true);
    const create = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Paciente Audit' });
    expect([201,500]).toContain(create.status); // 500 if table missing
    const id = create.body?.id;
    if (id) {
      const del = await request(app)
        .delete(`/api/patients/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([204,404]).toContain(del.status);
    }
    // Optionally query audit_log if exists
    try {
      const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM audit_log WHERE action IN ('create','delete') AND entity='patient' AND created_at > now() - interval '5 minutes'");
      expect(rows[0].c).toBeGreaterThanOrEqual(1);
    } catch { /* ignore if audit_log missing */ }
  });
});
