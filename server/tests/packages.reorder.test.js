const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let token;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const email = `pkg_reorder_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  token = login.body.token;
});

describe('Packages reorder flow', () => {
  // Helper local para crear análisis considerando columnas dinámicas (code/clave pueden variar por migraciones).
  async function createAnalysisFlexible(baseName){
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    const name = `${baseName}_${suffix}`;
    // Consultar las columnas presentes para decidir qué clave enviar.
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
    const colSet = new Set(cols.rows.map(r=>r.column_name));
    const keyValue = 'KR_'+suffix.toUpperCase();
    const payload = { name };
    if (colSet.has('code') && colSet.has('clave')) { payload.code = keyValue; payload.clave = keyValue; }
    else if (colSet.has('code')) { payload.code = keyValue; }
    else if (colSet.has('clave')) { payload.clave = keyValue; }
    const res = await request(app).post('/api/analysis').set('Authorization', `Bearer ${token}`).send(payload);
    expect([201,409]).toContain(res.status);
    // Si hubo 409 (duplicado improbable por sufijo único), intentar recuperar por nombre
    let id = res.body?.id;
    if (!id) {
      const list = await pool.query('SELECT id FROM analysis WHERE name=$1 LIMIT 1',[name]);
      id = list.rows[0]?.id;
    }
    expect(id).toBeTruthy();
    return id;
  }

  test('create package, add items, reorder, verify positions', async () => {
    if (!db) return expect(true).toBe(true);

    // 1) Crear 3 análisis válidos (incluyendo code/clave si es requerido por el esquema)
    const a1Id = await createAnalysisFlexible('A_Reorder_1');
    const a2Id = await createAnalysisFlexible('A_Reorder_2');
    const a3Id = await createAnalysisFlexible('A_Reorder_3');

    // 2) Crear paquete
    const pkgRes = await request(app).post('/api/packages').set('Authorization', `Bearer ${token}`).send({ name: `PKG_Reorder_${Date.now()}` });
    expect([201,409]).toContain(pkgRes.status);
    const packageId = pkgRes.body?.id || (await request(app).get('/api/packages?limit=1&offset=0').set('Authorization', `Bearer ${token}`)).body?.data?.[0]?.id;
    expect(packageId).toBeTruthy();

    // 3) Agregar 3 ítems (sin position => al final)
    const i1 = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: a1Id });
    const i2 = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: a2Id });
    const i3 = await request(app).post(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`).send({ item_id: a3Id });
    expect([201,409]).toContain(i1.status);
    expect([201,409]).toContain(i2.status);
    expect([201,409]).toContain(i3.status);

    // 4) Obtener items (ordenados por position)
    const list1 = await request(app).get(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`);
    expect(list1.status).toBe(200);
    const items1 = list1.body;
    expect(items1.length).toBeGreaterThanOrEqual(3);
    const ids1 = items1.map(x => x.id);

    // 5) Reordenar invirtiendo el orden actual
    const reversed = [...ids1].reverse();
    const re = await request(app).patch(`/api/packages/${packageId}/items/reorder`).set('Authorization', `Bearer ${token}`).send({ itemIds: reversed });
    expect(re.status).toBe(200);

    // 6) Verificar orden nuevo
    const list2 = await request(app).get(`/api/packages/${packageId}/items`).set('Authorization', `Bearer ${token}`);
    expect(list2.status).toBe(200);
    const items2 = list2.body;
    const ids2 = items2.map(x => x.id);
    expect(ids2.slice(0, reversed.length)).toEqual(reversed);
  });
});
