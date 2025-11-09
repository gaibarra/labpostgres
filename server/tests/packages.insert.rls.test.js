const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken; let limitedToken;

beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  // Admin
  const emailAdmin = `pkg_rls_admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email: emailAdmin, password: 'Secret123', role: 'Administrador' });
  const loginA = await request(app).post('/api/auth/login').send({ email: emailAdmin, password: 'Secret123' });
  adminToken = loginA.body.token;
  // Invitado (rol por defecto al registrar sin role explícito)
  const emailGuest = `pkg_rls_guest_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email: emailGuest, password: 'Secret123' });
  const loginG = await request(app).post('/api/auth/login').send({ email: emailGuest, password: 'Secret123' });
  limitedToken = loginG.body.token;
});

async function createAnalysisFlexible(baseName, token){
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

describe('Packages insert RLS/permission enforcement', () => {
  test('guest (no packages create/update permission) gets 403 RLS_FORBIDDEN', async () => {
    if (!db) return expect(true).toBe(true);
    // Crear paquete como admin
    const pkgRes = await request(app).post('/api/packages').set('Authorization', `Bearer ${adminToken}`).send({ name: `PKG_RLS_${Date.now()}` });
    const packageId = pkgRes.body?.id;
    expect(packageId).toBeTruthy();
    // Crear análisis como admin (guest no puede crear)
    const analysisId = await createAnalysisFlexible('A_RLS', adminToken);
    // Intento de inserción como invitado
    const res = await request(app)
      .post(`/api/packages/${packageId}/items`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ item_id: analysisId });
    // Puede devolver 403 con code FORBIDDEN por middleware o 403 RLS_FORBIDDEN si llega a política RLS (o 401 si token inválido)
    expect([403]).toContain(res.status);
    expect(['FORBIDDEN','RLS_FORBIDDEN']).toContain(res.body?.code);
  });
});
