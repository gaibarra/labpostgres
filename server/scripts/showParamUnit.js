#!/usr/bin/env node
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(err) { /* opcional */ }
function clean(val){ if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1); return val; }
const pattern = process.argv[2] || 'igg4';
(async ()=>{
  const pool = new Pool({ host: process.env.PGHOST, port: process.env.PGPORT||5432, user: process.env.PGUSER, password: clean(process.env.PGPASSWORD), database: process.env.PGDATABASE });
  try {
    const { rows } = await pool.query(`
      SELECT ap.id, ap.name, ap.unit, a.name AS analysis
      FROM analysis_parameters ap JOIN analysis a ON a.id=ap.analysis_id
      WHERE LOWER(ap.name) LIKE LOWER($1) OR LOWER(a.name) LIKE LOWER($1)
      ORDER BY ap.name
    `, [`%${pattern}%`]);
    console.log(JSON.stringify(rows, null, 2));
  } catch(e){ console.error('ERROR', e.message); process.exit(1); }
  finally { await pool.end().catch(()=>{}); }
})();