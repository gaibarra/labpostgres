#!/usr/bin/env node
/*
  Smoke test: Consults /api/analysis/detailed for a given search term and checks for duplicate reference ranges per parameter
  Usage:
    node scripts/smokeReferenceRanges.js "Amplitud de Distribución Eritrocitaria"
*/

const supertest = require('supertest');

(async () => {
  const search = process.argv[2] || 'Amplitud de Distribución Eritrocitaria';
  const app = require('..'); // index.js exports the express app
  const request = supertest.agent(app);

  try {
    // 1) Register and login a temp user
    const email = `smoke_${Date.now()}@test.com`;
    const password = 'Sm0ke!23456';

    await request
      .post('/api/auth/register')
      .send({ email, password, name: 'Smoke Tester', role: 'Administrador' })
      .expect(201);

    await request
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    // 2) Query analysis detailed endpoint with search
    const res = await request
      .get('/api/analysis/detailed')
      .query({ search })
      .expect(200);

    const { data } = res.body || {};
    if (!Array.isArray(data)) {
      throw new Error('Unexpected payload: missing data array');
    }

    const problems = [];

    for (const analysis of data) {
      for (const p of (analysis.parameters || [])) {
        const ranges = p.reference_ranges || [];
        // Build a dedupe key similar to backend unify/dedupe
        const seen = new Set();
        for (const r of ranges) {
          const num = v => (v === null || v === undefined || v === '') ? '' : Number(v);
          const txt = v => (v || '').toString().trim().toLowerCase();
          const key = [
            p.id || p.parameter_id || '',
            (r.sex || r.sexo || 'A').toString().toUpperCase(),
            num(r.age_from ?? r.age_min), num(r.age_to ?? r.age_max), txt(r.age_unit || r.age_unit_code || 'Y'),
            num(r.lower ?? r.min ?? r.valor_minimo), num(r.upper ?? r.max ?? r.valor_maximo),
            txt(r.text || r.texto || ''),
            txt(r.unit || r.unidad || ''),
            txt(r.method || r.metodo || ''),
          ].join('|');
          if (seen.has(key)) {
            problems.push({ analysis: analysis.name, parameter: p.name, dup: r });
          } else {
            seen.add(key);
          }
        }
      }
    }

    const summary = {
      search,
      analyses: data.length,
      duplicateFindings: problems.length,
      details: problems.slice(0, 10),
    };

    console.log(JSON.stringify(summary, null, 2));
    // Exit with non-zero if duplicates were found
    process.exit(problems.length > 0 ? 2 : 0);
  } catch (err) {
    console.error('[SMOKE] Error:', err && err.message || err);
    process.exit(1);
  } finally {
    // nothing to close: app is not listening under tests
  }
})();
