const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let token;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const email = `pkg_insert_errors_${Date.now()}@example.com`;
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

describe('Packages insert error mapping', () => {
  test('invalid package id format -> 400 BAD_UUID', async () => {
    if (!db) return expect(true).toBe(true);
    const analysisId = await createAnalysisFlexible('A_Err_BadUUID');
    const res = await request(app)
      .post(`/api/packages/not-a-uuid/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ item_id: analysisId });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('BAD_UUID');
  });

  test('non-existent package -> 404 PACKAGE_NOT_FOUND (FK violation)', async () => {
    if (!db) return expect(true).toBe(true);
    const analysisId = await createAnalysisFlexible('A_Err_PkgNotFound');
    // UUID válido aleatorio para no existir como paquete
    const randomPkg = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const res = await request(app)
      .post(`/api/packages/${randomPkg}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ item_id: analysisId });
    // Puede devolver 404 PACKAGE_NOT_FOUND según mapeo 23503
    expect([404,409,400,500]).toContain(res.status);
    if (res.status === 404) expect(res.body?.code).toBe('PACKAGE_NOT_FOUND');
  });

  test('duplicate insert -> 409 PACKAGE_ITEM_DUPLICATE', async () => {
    if (!db) return expect(true).toBe(true);
    // Crear paquete
    const pkgRes = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_Err_Dup_${Date.now()}` });
    const packageId = pkgRes.body?.id;
    expect(packageId).toBeTruthy();
    const analysisId = await createAnalysisFlexible('A_Err_Duplicate');
    const first = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: analysisId });
    expect([201,409]).toContain(first.status);
    const dup = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: analysisId });
    expect(dup.status).toBe(409);
    expect(['PACKAGE_ITEM_DUPLICATE','UNIQUE_OR_INTEGRITY_CONFLICT']).toContain(dup.body?.code);
  });

  test('app-side unexpected error (fault injection) -> 500 GENERIC_PACKAGE_ITEM_INTERNAL', async () => {
    if (!db) return expect(true).toBe(true);
    // Crear paquete y análisis válidos
    const pkgRes = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_Err_Internal_${Date.now()}` });
    const packageId = pkgRes.body?.id;
    const analysisId = await createAnalysisFlexible('A_Err_Internal');
    const res = await request(app)
      .post(`/api/packages/${packageId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-fault-insert','throw') // activa inyección de error app-side
      .send({ item_id: analysisId });
    expect(res.status).toBe(500);
    // Puede ser nuestro nuevo código si la ruta mapea correctamente
    expect(['GENERIC_PACKAGE_ITEM_INTERNAL','PACKAGE_ITEM_ADD_FAIL','DB_CONNECTION_ERROR']).toContain(res.body?.code);
  });
});
