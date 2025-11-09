const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let token;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const email = `pkg_faults_${Date.now()}@example.com`;
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

describe('Packages insert fault injection PG codes', () => {
  test('deadlock simulated -> 503 DEADLOCK_RETRY', async () => {
    if (!db) return expect(true).toBe(true);
    const pkg = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_FaultDead_${Date.now()}` });
    const packageId = pkg.body?.id; const analysisId = await createAnalysisFlexible('A_FaultDead');
    const res = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).set('x-fault-insert','deadlock').send({ item_id: analysisId });
    expect(res.status).toBe(503);
    expect(res.body?.code).toBe('DEADLOCK_RETRY');
  });

  test('missing column simulated -> 500 PACKAGE_ITEMS_COLUMN_MISSING', async () => {
    if (!db) return expect(true).toBe(true);
    const pkg = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_FaultCol_${Date.now()}` });
    const packageId = pkg.body?.id; const analysisId = await createAnalysisFlexible('A_FaultCol');
    const res = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).set('x-fault-insert','missing-column').send({ item_id: analysisId });
    expect(res.status).toBe(500);
    expect(res.body?.code).toBe('PACKAGE_ITEMS_COLUMN_MISSING');
  });

  test('missing function simulated -> 500 PG_FUNCTION_MISSING', async () => {
    if (!db) return expect(true).toBe(true);
    const pkg = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_FaultFunc_${Date.now()}` });
    const packageId = pkg.body?.id; const analysisId = await createAnalysisFlexible('A_FaultFunc');
    const res = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).set('x-fault-insert','missing-function').send({ item_id: analysisId });
    expect(res.status).toBe(500);
    expect(res.body?.code).toBe('PG_FUNCTION_MISSING');
  });

  test('position conflict simulated -> 409 PACKAGE_ITEM_POSITION_CONFLICT', async () => {
    if (!db) return expect(true).toBe(true);
    const pkg = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_FaultPos_${Date.now()}` });
    const packageId = pkg.body?.id; const analysisId = await createAnalysisFlexible('A_FaultPos');
    const res = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).set('x-fault-insert','position-conflict').send({ item_id: analysisId });
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe('PACKAGE_ITEM_POSITION_CONFLICT');
  });
});
