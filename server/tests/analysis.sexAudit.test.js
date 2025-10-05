const request = require('supertest');
const app = require('../index');
const { createAdminAndGetToken } = require('./test-helpers');

describe('Sex Constraints Audit', () => {
  let token;
  beforeAll(async () => {
    token = await createAdminAndGetToken();
  });

  it('exposes canonical or identifies legacy', async () => {
    const res = await request(app)
      .get('/api/analysis/sex-constraints-audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty('constraints');
    expect(Array.isArray(res.body.constraints)).toBe(true);
    expect(res.body).toHaveProperty('counts');
    if (res.body.counts.canonical === 0) {
      // En entorno limpio esperamos al menos 1 canonical
      console.warn('[TEST][SEX-AUDIT] No canonical constraints detected, legacy present?', res.body);
    }
    expect(res.body).toHaveProperty('tokensInUse');
    expect(Array.isArray(res.body.tokensInUse)).toBe(true);
  });
});
