const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken; let guestToken;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const ts = Date.now();
  const adminEmail = `cfgfull_admin_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'Secret123', role: 'Administrador' });
  const aLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'Secret123' });
  adminToken = aLogin.body.token;
  const guestEmail = `cfgfull_guest_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email: guestEmail, password: 'Secret123', role: 'Invitado' });
  const gLogin = await request(app).post('/api/auth/login').send({ email: guestEmail, password: 'Secret123' });
  guestToken = gLogin.body.token;
});

describe('Configuración (suite completa)', () => {
  test('RESET inicial (PUT all {}) para empezar limpio', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .put('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo:{}, reportSettings:{}, uiSettings:{}, regionalSettings:{}, integrations:{}, taxSettings:{} });
    expect(res.status).toBe(200);
    ['labInfo','reportSettings','uiSettings','regionalSettings','integrations','taxSettings'].forEach(k=>{
      expect(res.body).toHaveProperty(k);
      expect(typeof res.body[k]).toBe('object');
    });
  });

  test('GET inicial devuelve fila existente (no auto-create porque ya hay una)', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).get('/api/config').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('PATCH (admin) establece labInfo básico', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo: { name: 'Laboratorio Central', address: { street: 'Calle 1' } } });
    expect(res.status).toBe(200);
    expect(res.body.labInfo.name).toBe('Laboratorio Central');
    expect(res.body.labInfo.address).toEqual({ street: 'Calle 1' });
  });

  test('PATCH (admin) añade otra sección sin tocar labInfo (excepto reemplazos propios)', async () => {
    if (!db) return expect(true).toBe(true);
    // Añadimos uiSettings
    const res = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uiSettings: { theme: 'dark', locale: 'es-MX' } });
    expect(res.status).toBe(200);
    expect(res.body.uiSettings.theme).toBe('dark');
    expect(res.body.labInfo.name).toBe('Laboratorio Central');
  });

  test('PATCH (admin) sobre-escribe objeto anidado (jsonb || no hace deep merge)', async () => {
    if (!db) return expect(true).toBe(true);
    // Enviar solo address nuevo reemplaza address completo
    const res = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labInfo: { address: { city: 'CDMX' } } });
    expect(res.status).toBe(200);
    // name debe permanecer, address reemplazado (sin street)
    expect(res.body.labInfo.name).toBe('Laboratorio Central');
    expect(res.body.labInfo.address).toEqual({ city: 'CDMX' });
  });

  test('PATCH desconocido se ignora (sin cambios estructurales)', async () => {
    if (!db) return expect(true).toBe(true);
    const before = await request(app).get('/api/config').set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ unknownSection: { foo: 1 } });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('unknownSection');
  // NOTA: No afirmamos igualdad estricta de updated_at porque otro test paralelo puede haber modificado la configuración.
  // Verificamos simplemente que la respuesta conserva las secciones conocidas sin haber añadido la desconocida.
  expect(typeof res.body.updated_at).toBe('string');
  });

  test('PATCH integraciones vía endpoint dedicado y merge incremental', async () => {
    if (!db) return expect(true).toBe(true);
    const first = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openaiApiKey: 'sk-AAA' });
    expect(first.status).toBe(200);
    expect(first.body.integrations.openaiApiKey).toBe('sk-AAA');
    const second = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ whatsappApiKey: 'wapp-BBB' });
    expect(second.status).toBe(200);
    expect(second.body.integrations.openaiApiKey).toBe('sk-AAA'); // preservado
    expect(second.body.integrations.whatsappApiKey).toBe('wapp-BBB');
  });

  test('PATCH repetido idempotente (mismos valores) mantiene valores', async () => {
    if (!db) return expect(true).toBe(true);
    const before = await request(app).get('/api/config').set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .patch('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uiSettings: before.body.uiSettings });
    expect(res.status).toBe(200);
    expect(res.body.uiSettings).toEqual(before.body.uiSettings);
  });

  test('PUT reemplaza solo secciones provistas (taxSettings) preservando otras', async () => {
    if (!db) return expect(true).toBe(true);
    const before = await request(app).get('/api/config').set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .put('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ taxSettings: { iva: 16, retention: 4 } });
    expect(res.status).toBe(200);
    expect(res.body.taxSettings.iva).toBe(16);
    expect(res.body.labInfo.name).toBe(before.body.labInfo.name); // preservado
    expect(res.body.uiSettings).toEqual(before.body.uiSettings); // preservado
  });

  test('Guest no puede PATCH integraciones ni PUT', async () => {
    if (!db) return expect(true).toBe(true);
    const g1 = await request(app)
      .patch('/api/config/integrations')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ openaiApiKey: 'sk-FAIL' });
    expect(g1.status).toBe(403);
    const g2 = await request(app)
      .put('/api/config')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ labInfo: { name: 'Should Not' } });
    expect(g2.status).toBe(403);
  });
});
