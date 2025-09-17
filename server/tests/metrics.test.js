const request = require('supertest');
const app = require('..');

describe('Metrics endpoint', () => {
  test('exposes prometheus metrics with custom gauges', async () => {
  // Realiza primero una petición normal para que el histograma registre al menos una observación
  await request(app).get('/');
    const res = await request(app).get('/api/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    const body = res.text;
    expect(body).toMatch(/http_request_duration_seconds_bucket/);
    expect(body).toMatch(/db_pool_total_connections/);
    expect(body).toMatch(/db_pool_idle_connections/);
    expect(body).toMatch(/db_pool_waiting_clients/);
  });
});