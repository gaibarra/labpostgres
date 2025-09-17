const request = require('supertest');
const app = require('..');

describe('Misc endpoints', () => {
  test('health returns ok/fail field', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
  test('unknown route 404', async () => {
    const res = await request(app).get('/api/unknown-route-x');
    expect(res.status).toBe(404);
  });
});