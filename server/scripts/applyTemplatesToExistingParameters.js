#!/usr/bin/env node
/**
 * applyTemplatesToExistingParameters.js
 * Recorre parámetros existentes y, si no tienen rangos o sólo cualitativos,
 * intenta aplicar plantillas numéricas desde utils/referenceTemplates.
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) {
  try { require('dotenv').config(); } catch (_) { /* ignore */ }
}
const { Pool } = require('pg');
const { buildParameterTemplate } = require('../utils/referenceTemplates');

async function hasColumn(pool, table, column){
  const { rows } = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1",[table, column]);
  return !!rows[0];
}

async function main(){
  const dbName = process.argv.slice(2).find(a=>a.startsWith('--db='))?.split('=')[1]
    || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName){
    console.error('Falta --db o variable PGDATABASE/TENANT_DB');
    process.exit(1);
  }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  try {
    const colUnit = await hasColumn(pool,'analysis_reference_ranges','unit');
    const colNotes = await hasColumn(pool,'analysis_reference_ranges','notes');
  const _colMethod = await hasColumn(pool,'analysis_reference_ranges','method');

    const q = `
      SELECT a.id aid, a.name aname, ap.id pid, ap.name pname
      FROM analysis a
      JOIN analysis_parameters ap ON ap.analysis_id=a.id
    `;
    const { rows } = await pool.query(q);
    let applied=0, scanned=0;
    for (const r of rows){
      scanned++;
      const { rows: rr } = await pool.query('SELECT id, lower, upper, text_value FROM analysis_reference_ranges WHERE parameter_id=$1',[r.pid]);
      const hasRanges = rr.length>0;
      const onlyQual = hasRanges && rr.every(x => x.lower==null && x.upper==null);
      if (!hasRanges || onlyQual){
        const tpl = buildParameterTemplate(r.pname);
        if (tpl && Array.isArray(tpl.valorReferencia) && tpl.valorReferencia.length){
          for (const t of tpl.valorReferencia){
            const cols=['parameter_id','sex','age_min','age_max','age_min_unit'];
            const vals=['$1','$2','$3','$4','$5'];
            const par=[r.pid, t.sexo||'Ambos', t.edadMin ?? null, t.edadMax ?? null, t.unidadEdad || 'años'];
            if (t.valorMin!=null || t.valorMax!=null){ cols.push('lower','upper'); vals.push(`$${par.length+1}`,`$${par.length+2}`); par.push(t.valorMin ?? null, t.valorMax ?? null); }
            if (t.textoLibre!=null){ cols.push('text_value'); vals.push(`$${par.length+1}`); par.push(t.textoLibre); }
            if (t.notas!=null && colNotes){ cols.push('notes'); vals.push(`$${par.length+1}`); par.push(t.notas); }
            if (colUnit){ cols.push('unit'); vals.push(`$${par.length+1}`); par.push(tpl.unit || null); }
            await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, par);
          }
          applied++;
          console.log('[TPL][APPLY] %s -> %s', r.aname, r.pname);
        }
      }
    }
    console.log('[TPL][SUMMARY] Escaneados: %d, aplicadas: %d', scanned, applied);
  } catch(e){
    console.error('[TPL][ERROR]', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module){
  main();
}

module.exports = {};
