#!/usr/bin/env node
/**
 * migrateLegacyToModernRanges.js
 * Copia rangos desde reference_ranges (legacy: studies/parameters) hacia analysis_reference_ranges (moderno)
 * mapeando por nombre exacto de análisis (studies.name == analysis.name) y parámetro (parameters.name == analysis_parameters.name).
 * - Normaliza sexo a 'Ambos'|'Masculino'|'Femenino'.
 * - Evita duplicados: si existe una fila idéntica en moderno, la omite.
 * - Respeta unit/method si existen en moderno (si no, no se setean).
 * Uso:
 *   node server/scripts/migrateLegacyToModernRanges.js --db=lab_slug --like="FSH|LH|Estradiol|Prolactina|Progesterona|Testosterona|SHBG|GH" --write
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { try{ require('dotenv').config(); } catch(_err){ /* ignore */ } }
const { Pool } = require('pg');

function parseArgs(){
  const out={ write:false, like:null };
  for (const a of process.argv.slice(2)){
    if (a==='--write') out.write=true; else {
      const m=a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function normSex(v){
  const s=(v||'').toString().trim().toLowerCase();
  if (!s) return 'Ambos';
  if (['m','masculino','male','hombre'].includes(s)) return 'Masculino';
  if (['f','femenino','female','mujer'].includes(s)) return 'Femenino';
  if (['a','ambos','all','any','todos','o'].includes(s)) return 'Ambos';
  return 'Ambos';
}

function buildFilter(val){
  if (!val) return { sql:'', params:[] };
  const parts = String(val).split(/[|,]/).map(s=>s.trim()).filter(Boolean);
  if (!parts.length) return { sql:'', params:[] };
  const conds=[]; const params=[];
  for (const t of parts){
    const p = /[%_]/.test(t) ? t : `%${t}%`;
    params.push(p); const i=params.length;
    conds.push(`(aa.name ILIKE $${i} OR ap.name ILIKE $${i})`);
  }
  return { sql:`WHERE ${conds.join(' OR ')}`, params };
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName){ console.error('Falta --db o PGDATABASE'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  try {
    // Confirmar tablas
    const reg = async (t)=> (await pool.query('SELECT to_regclass($1) t',[`public.${t}`])).rows[0].t;
    const hasRR = await reg('reference_ranges');
    const hasAnalysis = await reg('analysis');
    const hasAP = await reg('analysis_parameters');
    const hasARR = await reg('analysis_reference_ranges');
    if (!hasRR || !hasAnalysis || !hasAP || !hasARR){
      console.error('[MIGR] Faltan tablas necesarias. reference_ranges:%s analysis:%s analysis_parameters:%s analysis_reference_ranges:%s', !!hasRR, !!hasAnalysis, !!hasAP, !!hasARR);
      process.exit(2);
    }

    const { sql:filterSql, params } = buildFilter(args.like);
    // Emparejar parámetros modernos con filas legacy cuyo parameter_id YA apunta al id de analysis_parameters
    const q = `
      SELECT rr.id AS legacy_rr_id, rr.sex AS legacy_sex, rr.age_min, rr.age_max, rr.age_min_unit,
        rr.lower, rr.upper, rr.text_value,
             aa.id AS analysis_id, aa.name AS analysis_name,
             ap.id AS modern_param_id, ap.name AS modern_param_name,
             COALESCE(ap.unit, aa.general_units) AS modern_unit
        FROM analysis aa
        JOIN analysis_parameters ap ON ap.analysis_id = aa.id
        JOIN reference_ranges rr ON rr.parameter_id = ap.id
        ${filterSql}
        ORDER BY aa.name, ap.name, rr.age_min NULLS FIRST
    `;
    const { rows } = await pool.query(q, params);
    if (!rows.length){ console.log('[MIGR] No hay filas legacy que mapear.'); return; }
    const actions=[];
    for (const r of rows){
      const sex = normSex(r.legacy_sex);
  const lower = r.lower != null ? r.lower : null;
  const upper = r.upper != null ? r.upper : null;
      actions.push({
        analysis: r.analysis_name,
        parameter: r.modern_param_name,
        parameter_id: r.modern_param_id,
        sex,
        age_min: r.age_min==null?null:Number(r.age_min),
        age_max: r.age_max==null?null:Number(r.age_max),
        age_min_unit: (r.age_min_unit || 'años'),
        lower, upper,
        text_value: r.text_value || null,
        unit: r.modern_unit || null,
        method: null
      });
    }

    // Mostrar plan
    console.log('Análisis\tParámetro\tSexo\tEdad\tValor');
    for (const a of actions){
      const v = a.text_value ? `text:"${a.text_value}"` : `${a.lower ?? 'null'}–${a.upper ?? 'null'}`;
      console.log(`${a.analysis}\t${a.parameter}\t${a.sex}\t${a.age_min ?? 'null'}–${a.age_max ?? 'null'}\t${v}`);
    }

    if (!args.write){
      console.log('\n[MIGR] Dry-run: usa --write para aplicar.');
      return;
    }

    // Insert evitando duplicados exactos
    let inserted=0, skipped=0;
    for (const a of actions){
      const { rows: exists } = await pool.query(
        `SELECT id FROM analysis_reference_ranges
           WHERE parameter_id=$1 AND sex=$2 AND age_min IS NOT DISTINCT FROM $3 AND age_max IS NOT DISTINCT FROM $4
             AND lower IS NOT DISTINCT FROM $5 AND upper IS NOT DISTINCT FROM $6 AND text_value IS NOT DISTINCT FROM $7`,
        [a.parameter_id, a.sex, a.age_min, a.age_max, a.lower, a.upper, a.text_value]
      );
      if (exists.length){ skipped++; continue; }
      await pool.query(
        `INSERT INTO analysis_reference_ranges(parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, text_value, unit, method, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [a.parameter_id, a.sex, a.age_min, a.age_max, a.age_min_unit, a.lower, a.upper, a.text_value, a.unit, a.method, 'Migrated from legacy']
      );
      inserted++;
    }
    console.log(`[MIGR] Insertados: ${inserted}, omitidos (duplicados): ${skipped}`);
  } finally { await pool.end(); }
}

if (require.main === module){
  main().catch(e=>{ console.error('[MIGR] Error:', e.message); process.exit(1); });
}

module.exports = {};
