const request = require('supertest');
const app = require('..');
const { createAdminAndGetToken } = require('./test-helpers');

describe('Patients security', () => {
  test('unauthorized access denied', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });
});

describe('Patients history cache control', () => {
  test('admin can invalidate catalog cache on demand', async () => {
    const token = await createAdminAndGetToken();

    const createRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        full_name: 'Cache Control Test',
        date_of_birth: '1990-01-01',
        sex: 'F'
      });
    expect(createRes.status).toBe(201);
    const patientId = createRes.body.id;

    const historyRes = await request(app)
      .get(`/api/patients/${patientId}/history`)
      .set('Authorization', `Bearer ${token}`);
    expect(historyRes.status).toBe(200);

    const firstInvalidate = await request(app)
      .post('/api/patients/history-cache/invalidate')
      .set('Authorization', `Bearer ${token}`);
    expect(firstInvalidate.status).toBe(200);
    expect(firstInvalidate.body).toMatchObject({ cleared: true, previouslyWarm: true });

    const secondInvalidate = await request(app)
      .post('/api/patients/history-cache/invalidate')
      .set('Authorization', `Bearer ${token}`);
    expect(secondInvalidate.status).toBe(200);
    expect(secondInvalidate.body).toMatchObject({ cleared: true, previouslyWarm: false });
  });
});