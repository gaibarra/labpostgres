const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let token;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const email = `pkg_insert_pos_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  token = login.body.token;
});

async function createAnalysisFlexible(baseName){
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const name = `${baseName}_${suffix}`;
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.rows.map(r=>r.column_name));
  const keyValue = 'KI_'+suffix.toUpperCase();
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
  return { id, name };
}

describe('Packages insert with explicit middle position', () => {
  test('insert item with position=2 creates gap shift and final order is A1,A2,A3', async () => {
    if (!db) return expect(true).toBe(true);

    // 1) Crear 3 análisis válidos
    const a1 = await createAnalysisFlexible('A_InsertPos_1');
    const a2 = await createAnalysisFlexible('A_InsertPos_2');
    const a3 = await createAnalysisFlexible('A_InsertPos_3');

    // 2) Crear paquete
    const pkgRes = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_InsertPos_${Date.now()}` });
    expect([201,409]).toContain(pkgRes.status);
    const packageId = pkgRes.body?.id || (await request(app).get('/api/packages?limit=1&offset=0').set('Authorization', `Bearer ${token}`)).body?.data?.[0]?.id;
    expect(packageId).toBeTruthy();

    // 3) Agregar A1 (pos 1) y A3 (pos 2 por defecto)
    const i1 = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: a1.id });
    const i3 = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: a3.id });
    expect([201,409]).toContain(i1.status);
    expect([201,409]).toContain(i3.status);

    // 4) Insertar A2 en position=2 (debe empujar A3 a position=3)
    const i2 = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: a2.id, position: 2 });
    expect([201,409]).toContain(i2.status);

    // 5) Listar y verificar orden A1, A2, A3 por position
    const list = await request(app).get(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const items = list.body;
    expect(items.length).toBeGreaterThanOrEqual(3);
    // Ordenados por position asc (NULLS LAST) -> deben iniciar con A1, A2, A3
    const firstThree = items.slice(0,3);
    const names = firstThree.map(x=>x.name);
    expect(names).toEqual([a1.name, a2.name, a3.name]);
    const positions = firstThree.map(x=>x.position);
    expect(positions).toEqual([1,2,3]);
  });
});
