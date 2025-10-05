#!/usr/bin/env node
// Script de diagnóstico de constraint de sexo para reference_ranges
const { pool } = require('../db');

(async () => {
  try {
    const constraints = await pool.query(`SELECT c.conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE t.relname='reference_ranges' AND c.contype='c'
      ORDER BY c.conname`);
    const distinctSex = await pool.query('SELECT DISTINCT sex FROM reference_ranges ORDER BY 1');
    console.log('--- Constraints reference_ranges.sex ---');
    constraints.rows.forEach(r=> console.log(r.conname+': '+r.def));
    console.log('\n--- Valores distintos en reference_ranges.sex ---');
    distinctSex.rows.forEach(r=> console.log(r.sex === null ? '(NULL)' : r.sex));
    // Quick health heuristic
    const tokens = new Set(distinctSex.rows.filter(r=>r.sex).map(r=>r.sex));
    const expected = ['Ambos','Masculino','Femenino'];
    const missing = expected.filter(t=>!tokens.has(t));
    console.log('\nHeurística:');
    if (missing.length) {
      console.log('Faltan tokens esperados:', missing.join(','));
    } else {
      console.log('Todos los tokens esperados presentes.');
    }
  } catch (e) {
    console.error('Error diagnóstico:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
