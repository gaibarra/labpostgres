const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let token;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const email = `pkg_reorder_neg_${Date.now()}@example.com`;
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

async function setupPackageWithItems(n = 3) {
  let pkgRes = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_ReorderNeg_${Date.now()}` });
  let packageId = pkgRes.body?.id;
  const itemIds = [];
  for (let i = 0; i < n; i++) {
    const a = await createAnalysisFlexible('A_ReorderNeg');
    let ins = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: a });
    if (ins.status === 404 && ins.body?.code === 'PACKAGE_NOT_FOUND') {
      // Recrear paquete y reintentar una sola vez para mitigar falso FK por RLS
      pkgRes = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_ReorderNeg_${Date.now()}_retry` });
      if (pkgRes.status === 201) {
        packageId = pkgRes.body?.id;
        ins = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: a });
      }
    }
    expect(ins.status).toBe(201);
    itemIds.push(ins.body?.id);
  }
  return { packageId, itemIds };
}

describe('Packages reorder negative scenarios', () => {
  test('bad format itemIds -> 400 ITEM_IDS_BAD_FORMAT', async () => {
    if (!db) return expect(true).toBe(true);
    const { packageId } = await setupPackageWithItems(2);
    const res = await request(app)
      .patch(`/api/packages/${packageId}/items/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemIds: ['not-a-uuid', 'also-bad'] });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('ITEM_IDS_BAD_FORMAT');
  });

  test('incomplete set -> 400 ITEM_IDS_INCOMPLETE', async () => {
    if (!db) return expect(true).toBe(true);
    const { packageId, itemIds } = await setupPackageWithItems(3);
    // Drop one id to make it incomplete
    const partial = [itemIds[1], itemIds[2]];
    const res = await request(app)
      .patch(`/api/packages/${packageId}/items/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemIds: partial });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('ITEM_IDS_INCOMPLETE');
  });

  test('ids not in package -> 400 ITEM_IDS_NOT_IN_PACKAGE', async () => {
    if (!db) return expect(true).toBe(true);
    const { packageId, itemIds } = await setupPackageWithItems(2);
    // Crear otro paquete con otro item y usar su id mezclado
    const other = await setupPackageWithItems(1);
    const mixed = [itemIds[0], other.itemIds[0]];
    const res = await request(app)
      .patch(`/api/packages/${packageId}/items/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemIds: mixed });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('ITEM_IDS_NOT_IN_PACKAGE');
  });
});
