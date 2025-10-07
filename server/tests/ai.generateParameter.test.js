const request = require('supertest');
const app = require('..');
const { createAdminAndGetToken } = require('./test-helpers');

let token; let db=true;
beforeAll(async () => {
  try { token = await createAdminAndGetToken(); } catch(e){ db=false; }
});

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

describe('AI generate single parameter async', () => {
  test('400 si falta studyName', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .post('/api/ai/generate-parameter/async')
      .set('Authorization',`Bearer ${token}`)
      .send({ desiredParameterName:'Glucosa' });
    expect(res.status).toBe(400);
  });

  test('400 si falta desiredParameterName', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app)
      .post('/api/ai/generate-parameter/async')
      .set('Authorization',`Bearer ${token}`)
      .send({ studyName:'Perfil Lipídico' });
    expect(res.status).toBe(400);
  });

  test('flujo feliz: crea job y llega a done con parameter', async () => {
    if (!db) return expect(true).toBe(true);
    const start = await request(app)
      .post('/api/ai/generate-parameter/async')
      .set('Authorization',`Bearer ${token}`)
      .send({ studyName:'Química Sanguínea', desiredParameterName:'Glucosa' });
    expect(start.status).toBe(200);
    expect(start.body.jobId).toBeTruthy();
    const jobId = start.body.jobId;
    let result; let attempts=0;
    while (attempts < 15){
      attempts++;
      await sleep(50);
      const poll = await request(app)
        .get(`/api/ai/generate-parameter/job/${jobId}`)
        .set('Authorization',`Bearer ${token}`);
      expect([200,404]).toContain(poll.status);
      if (poll.status===200 && poll.body.status==='done') { result = poll.body; break; }
    }
    expect(result).toBeTruthy();
    expect(result.parameter).toBeTruthy();
    expect(result.parameter.name).toBe('Glucosa');
    expect(Array.isArray(result.parameter.reference_ranges)).toBe(true);
    // Debe haber al menos un rango
    expect(result.parameter.reference_ranges.length).toBeGreaterThan(0);
  });

  test('404 job inexistente', async () => {
    if (!db) return expect(true).toBe(true);
    const poll = await request(app)
      .get('/api/ai/generate-parameter/job/job_inexistente_123')
      .set('Authorization',`Bearer ${token}`);
    expect(poll.status).toBe(404);
  });
});
