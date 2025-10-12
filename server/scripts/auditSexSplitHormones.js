#!/usr/bin/env node
/**
 * auditSexSplitHormones.js
 * Verifica que parámetros hormonales definidos tengan split por sexo en tramos adultos (>=12 años).
 * Uso: node server/scripts/auditSexSplitHormones.js --db=lab_demo [--like="%Hormonal%|%Ginecol%"]
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* ignore */ }

function parseArgs(){
  const out={};
  process.argv.slice(2).forEach(a=>{ const m=a.match(/^--([^=]+)=(.*)$/); if(m) out[m[1]]=m[2]; });
  return out;
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.PGDATABASE;
  const like = args.like || '%Hormonal%|%Ginecol%';
  if (!dbName){
    console.error('Debe indicar --db=nombre_db o configurar PGDATABASE');
    process.exit(1);
  }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName
  });
  try {
    const q = `
      WITH a AS (
        SELECT id, name FROM analysis
        WHERE (LOWER(name) ~* $1 OR COALESCE(code,'') ~* $1)
      ), p AS (
        SELECT ap.id, ap.name, ap.analysis_id FROM analysis_parameters ap
        JOIN a ON a.id=ap.analysis_id
      ), r AS (
   SELECT p.name param_name, a.name analysis_name,
     COALESCE(arr.sex,'Ambos') sex,
     arr.age_min, arr.age_max
   FROM p
   JOIN a ON a.id = p.analysis_id
   JOIN analysis_reference_ranges arr ON arr.parameter_id = p.id
      ), adult AS (
        SELECT analysis_name, param_name,
               COUNT(DISTINCT CASE WHEN age_min >= 12 THEN sex END) AS adult_sex_variants,
               STRING_AGG(DISTINCT CASE WHEN age_min >= 12 THEN sex END, ', ') FILTER (WHERE age_min >= 12) AS adult_sexes
        FROM r
        GROUP BY analysis_name, param_name
      )
      SELECT * FROM adult ORDER BY analysis_name, param_name;
    `;
    const { rows } = await pool.query(q, [like]);
    let ok = true;
    for (const row of rows){
      const variants = row.adult_sex_variants || 0;
      if (variants > 0 && variants < 2){
        ok = false;
        console.log('[AUDIT][WARN] %s > %s: adultos con sexo=%s (se esperaba Masculino y Femenino)', row.analysis_name, row.param_name, row.adult_sexes || 'Ambos');
      }
      if (variants === 0){
        // No hay tramos adultos, ignorar (poco probable en hormonales)
      }
    }
    if (ok) {
      console.log('[AUDIT] OK: Todos los parámetros revisados tienen split por sexo en tramos adultos.');
      process.exit(0);
    } else {
      console.log('[AUDIT] Inconsistencias detectadas.');
      process.exit(2);
    }
  } catch(e){
    console.error('[AUDIT] Error:', e.message);
    process.exit(1);
  }
}

if (require.main === module){
  main();
}
