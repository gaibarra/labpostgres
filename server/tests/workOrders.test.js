const request = require('supertest');
const app = require('..');

describe('Work orders security', () => {
  test('unauthorized access denied', async () => {
    const res = await request(app).get('/api/work-orders');
    expect(res.status).toBe(401);
  });
});