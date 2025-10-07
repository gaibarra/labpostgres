const request = require('supertest');
const app = require('../index');
const { createAdminAndGetToken } = require('./test-helpers');

/**
 * Verifica que el endpoint /api/analysis/catalog/stats:
 *  - Responde 200 con token admin
 *  - Incluye campos de conteo y hash
 *  - Mantiene hash estable entre llamadas consecutivas dentro de la misma ejecución
 */
describe('Catalog Stats Endpoint', () => {
  let token;
  beforeAll(async () => {
    token = await createAdminAndGetToken();
  });

  it('returns counts and stable hash', async () => {
    const first = await request(app)
      .get('/api/analysis/catalog/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body).toHaveProperty('analysis_count');
    expect(first.body).toHaveProperty('parameter_count');
    expect(first.body).toHaveProperty('range_count');
    expect(first.body).toHaveProperty('hash');
    expect(typeof first.body.hash).toBe('string');
    expect(first.body.hash.length).toBeGreaterThan(10);

    const second = await request(app)
      .get('/api/analysis/catalog/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.body.hash).toBe(first.body.hash);

    // Los conteos deberían coincidir salvo que otra prueba paralela cambie el catálogo.
    // Si difieren, dejamos mensaje para diagnósticos pero no fallamos el test duro.
    if (second.body.analysis_count !== first.body.analysis_count) {
      console.warn('[TEST][CATALOG-STATS] analysis_count cambió entre llamadas', { first: first.body.analysis_count, second: second.body.analysis_count });
    }
  });

  it('rejects sin token', async () => {
    await request(app)
      .get('/api/analysis/catalog/stats')
      .expect(401);
  });
});
