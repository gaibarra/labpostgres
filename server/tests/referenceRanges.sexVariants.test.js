const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

let token; let analysisId;

beforeAll(async ()=>{
  token = await createAdminAndGetToken();
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const payload = { name: 'Sexo Variantes ' + suffix };
  if (colSet.has('clave')) payload.clave = 'SEXVAR_' + suffix; else if (colSet.has('code')) payload.code = 'SEXVAR_' + suffix;
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  if (res.status !== 201) {
    // Log para depurar en caso de 409 u otro
    // eslint-disable-next-line no-console
    console.error('Fallo creación analysis sexVariants', res.status, res.body);
  }
  expect(res.status).toBe(201);
  analysisId = res.body.id;
});

describe('Reference Ranges sexo variantes casing', ()=>{
  const inputs = ['ambos','Ambos','AMBOS','masculino','Masculino','MASCULINO','femenino','FEMENINO','Femenino'];
  for (const sexInput of inputs) {
    test(`inserta rango con sex='${sexInput}'`, async ()=>{
      const sync = await request(app)
        .post(`/api/analysis/${analysisId}/parameters-sync`)
        .set('Authorization',`Bearer ${token}`)
        .send({ parameters: [ { name: 'Param '+sexInput, unit: 'u', reference_ranges: [ { sex: sexInput, lower: 1, upper: 2 } ] } ] });
      expect(sync.status).toBe(200);
      const rr = sync.body.parameters[0].reference_ranges[0];
      expect(['Ambos','Masculino','Femenino']).toContain(rr.sex);
    });
  }
});
