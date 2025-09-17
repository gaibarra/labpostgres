const request = require('supertest');
const app = require('..');

describe('Patients security', () => {
  test('unauthorized access denied', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });
});