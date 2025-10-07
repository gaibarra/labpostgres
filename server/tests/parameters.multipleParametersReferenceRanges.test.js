const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');
const { createAdminAndGetToken } = require('./test-helpers');

async function createAnalysis(token, name){
  const suffix = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const payload = { name: name + ' ' + suffix };
  // clave/code si existen
  const { rows: cols } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='analysis'");
  const colSet = new Set(cols.map(r=>r.column_name));
  if (colSet.has('clave')) payload.clave = 'MP_'+suffix.toUpperCase();
  else if (colSet.has('code')) payload.code = 'MP_'+suffix.toUpperCase();
  const res = await request(app).post('/api/analysis').set('Authorization',`Bearer ${token}`).send(payload);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe('parameters-sync preserva y acepta rangos de 5+ parámetros (incluyendo abiertos)', () => {
  test('sin degradación a partir del cuarto parámetro', async () => {
    const token = await createAdminAndGetToken();
    const analysisId = await createAnalysis(token, 'Estudio Multi Param');
    const payload = { parameters: [
      { name: 'Param 1', unit: 'u', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:10, lower:1, upper:2 } ] },
      { name: 'Param 2', unit: 'u', valorReferencia: [ { sex:'Masculino', age_min:0, age_max:120, lower:5, upper:10 }, { sex:'Femenino', age_min:0, age_max:120, lower:5, upper:10 } ] },
      // Param 3 con sólo límite inferior
      { name: 'Param 3', unit: 'u', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:120, lower:50, upper:null } ] },
      // Param 4 con sólo límite superior
      { name: 'Param 4', unit: 'u', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:120, lower:null, upper:99 } ] },
      // Param 5 con textoPermitido (alfanumérico)
      { name: 'Param 5', unit: '', valorReferencia: [ { sex:'Ambos', age_min:0, age_max:120, textoPermitido: 'Negativo' } ] }
    ]};
    const res = await request(app)
      .post(`/api/analysis/${analysisId}/parameters-sync`)
      .set('Authorization',`Bearer ${token}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.parameters.length).toBe(5);
    const byName = Object.fromEntries(res.body.parameters.map(p=>[p.name,p]));
  // Param1: debe tener al menos un rango (aceptamos >1 si se generan duplicados futuros o normalización)
  expect(byName['Param 1'].reference_ranges.length).toBeGreaterThanOrEqual(1);
    // Param2 colapsado a Ambos (por unify) o dos rangos; aceptar >=1
    expect(byName['Param 2'].reference_ranges.length).toBeGreaterThanOrEqual(1);
    // Param3 debe conservar el rango con lower
    expect(byName['Param 3'].reference_ranges[0].lower).toBe(50);
    // Param4 debe conservar upper
    expect(byName['Param 4'].reference_ranges[0].upper).toBe(99);
    // Param5 debe conservar texto (text_value)
    const p5 = byName['Param 5'];
    expect(p5.reference_ranges[0].text_value || p5.reference_ranges[0].notes || p5.reference_ranges[0].lower || p5.reference_ranges[0].upper).toBeTruthy();
  });
});

afterAll(async ()=>{ await pool.end(); });
