#!/usr/bin/env node
/**
 * check-missing-units.js
 * Reporta parámetros con valores de referencia numéricos pero sin unidad definida.
 * Criterio: analysis_parameters.unit es NULL o vacío y existe al menos un rango (legacy o moderno)
 *           con lower o upper no nulos.
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(err) { /* opcional */ }

function clean(val){ if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1); return val; }

async function main(){
  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER,
    password: clean(process.env.PGPASSWORD),
    database: process.env.PGDATABASE
  });
  try {
    const envWL = String(process.env.MISSING_UNITS_WHITELIST || '').split(',').map(s=>s.trim()).filter(Boolean).map(s=>s.toLowerCase());
    const DEFAULT_WL = [
      'inr',
      'ph',
      'ph arterial',
      'ph fecal',
      'lupus anticoagulante (drvvt ratio)',
      'resistencia a proteína c activada'
    ];
    const WHITELIST = new Set([...DEFAULT_WL, ...envWL]);
    const has = async (table) => {
      const { rows } = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
      return !!rows[0].t;
    };
    const parts = [];
    if (await has('reference_ranges')) {
      parts.push(`EXISTS (SELECT 1 FROM reference_ranges rr WHERE rr.parameter_id = ap.id AND (rr.lower IS NOT NULL OR rr.upper IS NOT NULL))`);
    }
    if (await has('analysis_reference_ranges')) {
      parts.push(`EXISTS (SELECT 1 FROM analysis_reference_ranges arr WHERE arr.parameter_id = ap.id AND (arr.lower IS NOT NULL OR arr.upper IS NOT NULL))`);
    }
    if (!parts.length) {
      console.log(JSON.stringify({ ok:true, total:0, items:[] }));
      return;
    }
    const sql = `
      SELECT ap.id, ap.name, ap.unit, a.name AS analysis_name
      FROM analysis_parameters ap
      JOIN analysis a ON a.id = ap.analysis_id
      WHERE (ap.unit IS NULL OR TRIM(ap.unit) = '') AND (
        ${parts.join(' OR ')}
      )
      ORDER BY LOWER(ap.name) ASC
    `;
  const { rows } = await pool.query(sql);
  const filtered = rows.filter(r => !WHITELIST.has(String(r.name||'').toLowerCase()));
  console.log(JSON.stringify({ ok:true, total: filtered.length, items: filtered.slice(0, 50) }, null, 2));
  } catch (e) {
    console.error('ERROR check-missing-units:', e.message);
    process.exit(1);
  } finally { await pool.end().catch(()=>{}); }
}

if (require.main === module) main();
