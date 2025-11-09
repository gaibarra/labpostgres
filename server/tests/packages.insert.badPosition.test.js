const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let token;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const email = `pkg_badpos_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  token = login.body.token;
});

async function createAnalysisFlexible(baseName){
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const name = `${baseName}_${suffix}`;
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.rows.map(r=>r.column_name));
  const keyValue = 'KE_'+suffix.toUpperCase();
  const payload = { name };
  if (colSet.has('code') && colSet.has('clave')) { payload.code = keyValue; payload.clave = keyValue; }
  else if (colSet.has('code')) { payload.code = keyValue; }
  else if (colSet.has('clave')) { payload.clave = keyValue; }
  const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`).send(payload);
  expect([201,409]).toContain(res.status);
  let id = res.body?.id;
  if (!id) {
    const list = await pool.query('SELECT id FROM analysis WHERE name=$1 LIMIT 1',[name]);
    id = list.rows[0]?.id;
  }
  expect(id).toBeTruthy();
  return id;
}

describe('Packages insert with bad position validation', () => {
  test('position <= 0 should return 400 BAD_POSITION', async () => {
    if (!db) return expect(true).toBe(true);
    const pkg = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_BadPos_${Date.now()}` });
    const packageId = pkg.body?.id;
    expect(packageId).toBeTruthy();
    const analysisId = await createAnalysisFlexible('A_BadPos');
    const res0 = await request(app)
      .post(`/api/packages/${packageId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ item_id: analysisId, position: 0 });
    expect(res0.status).toBe(400);
    expect(res0.body?.code).toBe('BAD_POSITION');

    const resNeg = await request(app)
      .post(`/api/packages/${packageId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ item_id: analysisId, position: -3 });
    expect(resNeg.status).toBe(400);
    expect(resNeg.body?.code).toBe('BAD_POSITION');
  });
});
