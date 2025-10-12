#!/usr/bin/env node
/**
 * report-sex-exclusive.js
 * Reporta parámetros y estudios que, según los rangos de referencia, son exclusivos para Femenino o para Masculino.
 * Criterio parámetro sexo-exclusivo:
 *  - Tiene al menos un rango en alguna tabla de rangos (legacy o moderna), y
 *  - El conjunto de sex en sus rangos es únicamente {Femenino} o únicamente {Masculino}.
 *  - Si existe 'Ambos' (o 'O' legacy) o hay mezcla M y F, NO se considera exclusivo.
 * Criterio estudio sexo-exclusivo:
 *  - Todos sus parámetros son sexo-exclusivos para el mismo sexo (y al menos 1 parámetro).
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(err) { /* .env opcional para este script */ }

function clean(val){ if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1); return val; }

function normalizeSexToken(s){
  if (!s) return null;
  const v = String(s).trim();
  const lc = v.toLowerCase();
  if (lc === 'm' || lc.startsWith('mas')) return 'Masculino';
  if (lc === 'f' || lc.startsWith('fem')) return 'Femenino';
  if (lc === 'o' || lc.startsWith('amb')) return 'Ambos';
  // Fallback: si no matchea nada conocido, devolver tal cual capitalizado para no romper el análisis
  return v.charAt(0).toUpperCase()+v.slice(1);
}

async function main(){
  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER,
    password: clean(process.env.PGPASSWORD),
    database: process.env.PGDATABASE
  });
  try {
    // Detectar tablas de rangos disponibles
    const hasTbl = async (t)=>{ const { rows } = await pool.query('SELECT to_regclass($1) AS t',[`public.${t}`]); return !!rows[0].t; };
    const hasModern = await hasTbl('analysis_reference_ranges');
    const hasLegacy = await hasTbl('reference_ranges');
    if (!hasModern && !hasLegacy) {
      console.log(JSON.stringify({ ok:true, femaleOnly:[], maleOnly:[], studies:{ femaleOnly:[], maleOnly:[] }, note:'No hay tablas de rangos' }, null, 2));
      return;
    }
    const unionParts = [];
    if (hasModern) unionParts.push('SELECT parameter_id, sex FROM analysis_reference_ranges');
    if (hasLegacy) unionParts.push('SELECT parameter_id, sex FROM reference_ranges');
    const sql = `
      WITH rr AS (
        ${unionParts.join('\nUNION ALL\n')}
      )
      SELECT ap.id AS param_id, ap.name AS param_name, a.id AS analysis_id, a.name AS analysis_name,
             ARRAY_AGG(DISTINCT rr.sex) AS sexes
      FROM rr
      JOIN analysis_parameters ap ON ap.id = rr.parameter_id
      JOIN analysis a ON a.id = ap.analysis_id
      GROUP BY ap.id, a.id, ap.name, a.name
      ORDER BY LOWER(a.name), LOWER(ap.name)
    `;
    const { rows } = await pool.query(sql);
    const femaleOnly = [];
    const maleOnly = [];
    const byStudy = new Map(); // analysis_id -> { name, femaleOnlyParams:[], maleOnlyParams:[], totalParams:Set }
    for (const r of rows){
      const sexes = new Set((r.sexes||[]).map(normalizeSexToken));
      const hasAmbos = sexes.has('Ambos');
      const hasM = sexes.has('Masculino');
      const hasF = sexes.has('Femenino');
      const paramInfo = { parameter_id: r.param_id, parameter: r.param_name, analysis_id: r.analysis_id, analysis: r.analysis_name };
      if (!hasAmbos) {
        if (hasF && !hasM) femaleOnly.push(paramInfo);
        else if (hasM && !hasF) maleOnly.push(paramInfo);
      }
      if (!byStudy.has(r.analysis_id)) byStudy.set(r.analysis_id, { name: r.analysis_name, femaleOnlyParams: [], maleOnlyParams: [], allParams: new Set() });
      const s = byStudy.get(r.analysis_id);
      s.allParams.add(r.param_id);
      if (!hasAmbos) {
        if (hasF && !hasM) s.femaleOnlyParams.push(r.param_id);
        else if (hasM && !hasF) s.maleOnlyParams.push(r.param_id);
      }
    }
    const studiesFemaleOnly = [];
    const studiesMaleOnly = [];
    for (const [id, s] of byStudy.entries()){
      const total = s.allParams.size;
      if (total > 0) {
        if (s.femaleOnlyParams.length === total && s.maleOnlyParams.length === 0) {
          studiesFemaleOnly.push({ analysis_id: id, analysis: s.name, param_count: total });
        } else if (s.maleOnlyParams.length === total && s.femaleOnlyParams.length === 0) {
          studiesMaleOnly.push({ analysis_id: id, analysis: s.name, param_count: total });
        }
      }
    }
    console.log(JSON.stringify({ ok:true, femaleOnly, maleOnly, studies: { femaleOnly: studiesFemaleOnly, maleOnly: studiesMaleOnly } }, null, 2));
  } catch (e) {
    console.error('ERROR report-sex-exclusive:', e.message);
    process.exit(1);
  }
}

if (require.main === module) main();
