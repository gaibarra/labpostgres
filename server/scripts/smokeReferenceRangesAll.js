#!/usr/bin/env node
/*
  Smoke test (catálogo completo):
  - Recorre /api/analysis/detailed paginado (limit=100) para todo el catálogo
  - Detecta duplicados de reference_ranges por parámetro usando llave canonizada
  - Imprime resumen (analyses, parameters, duplicates) y lista primeras 20 incidencias
  - Exit code: 0 si sin duplicados, 2 si hay duplicados, 1 si error
*/

const supertest = require('supertest');

function num(v){ return (v === null || v === undefined || v === '') ? '' : Number(v); }
function txt(v){ return (v || '').toString().trim().toLowerCase(); }
function makeKey(p, r){
  return [
    p.id || p.parameter_id || '',
    (r.sex || r.sexo || 'A').toString().toUpperCase(),
    num(r.age_from ?? r.age_min ?? r.edad_min),
    num(r.age_to ?? r.age_max ?? r.edad_max),
    txt(r.age_unit || r.age_unit_code || r.age_min_unit || 'Y'),
    num(r.lower ?? r.min ?? r.min_value ?? r.valor_minimo),
    num(r.upper ?? r.max ?? r.max_value ?? r.valor_maximo),
    txt(r.text || r.text_value || r.texto || ''),
    txt(r.unit || r.unidad || ''),
    txt(r.method || r.metodo || ''),
  ].join('|');
}

(async () => {
  const app = require('..');
  const request = supertest.agent(app);
  try {
    // 1) Usuario admin temporal
    const email = `smoke_all_${Date.now()}@test.com`;
    const password = 'Sm0ke!23456';
    await request.post('/api/auth/register').send({ email, password, role: 'Administrador', full_name: 'Smoke All' }).expect(201);
    await request.post('/api/auth/login').send({ email, password }).expect(200);

    // 2) Paginación
  const limit = 100;
  let offset = 0;
  let total = undefined;
    const problems = [];
    let analysesCount = 0;
    let parametersCount = 0;

  // Bucle de paginación: ejecuta al menos una vez y corta cuando no haya más páginas
  // Usamos do/while para evitar condición constante
  let keepGoing = true;
  while (keepGoing) {
      const res = await request.get('/api/analysis/detailed').query({ limit, offset }).expect(200);
      const body = res.body || {};
      const list = Array.isArray(body.data) ? body.data : [];
      analysesCount += list.length;
      total = body.page?.total ?? total;

      for (const analysis of list) {
        for (const p of (analysis.parameters || [])) {
          parametersCount++;
          const seen = new Set();
          for (const r of (p.reference_ranges || [])) {
            const key = makeKey(p, r);
            if (seen.has(key)) {
              problems.push({ analysis: analysis.name, parameter: p.name, dup: r });
              if (problems.length >= 1000) break; // cap report
            } else {
              seen.add(key);
            }
          }
          if (problems.length >= 1000) break;
        }
        if (problems.length >= 1000) break;
      }
      if (list.length < limit || (typeof total === 'number' && offset + limit >= total)) {
        keepGoing = false;
      } else {
        offset += limit;
      }
    }

    const summary = {
      analyses: analysesCount,
      parameters: parametersCount,
      duplicateFindings: problems.length,
      sample: problems.slice(0, 20)
    };
    console.log(JSON.stringify(summary, null, 2));
    process.exit(problems.length > 0 ? 2 : 0);
  } catch (err) {
    console.error('[SMOKE ALL] Error:', err && err.message || err);
    process.exit(1);
  }
})();
