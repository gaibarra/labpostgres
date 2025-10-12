#!/usr/bin/env node
const { pool } = require('../db');

async function tableExists(name) {
  const { rows } = await pool.query('SELECT to_regclass($1) AS t', [`public.${name}`]);
  return !!rows[0].t;
}

async function columnSet(table) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return new Set(rows.map(r => r.column_name));
}

async function countDuplicatesReferenceRanges() {
  if (!(await tableExists('reference_ranges'))) return { exists: false };
  const cols = await columnSet('reference_ranges');
  const hasLower = cols.has('lower');
  const hasText = cols.has('text_value');
  // Clave natural del índice único en legacy: param, sex, age_min, age_max, age_min_unit, lower/min_value, upper/max_value, text_value
  const lowerExpr = hasLower ? 'COALESCE(lower,-999999)' : 'COALESCE(min_value,-999999)';
  const upperExpr = hasLower ? 'COALESCE(upper,-999999)' : 'COALESCE(max_value,-999999)';
  const textExpr = hasText ? "COALESCE(text_value,'')" : "''";
  const q = `SELECT COUNT(*)::int AS dups FROM (
    SELECT parameter_id,
           COALESCE(sex,'Ambos') AS sex,
           COALESCE(age_min,-1) AS age_min,
           COALESCE(age_max,-1) AS age_max,
           COALESCE(age_min_unit,'años') AS age_min_unit,
           ${lowerExpr} AS lower,
           ${upperExpr} AS upper,
           ${textExpr} AS text_value,
           COUNT(*)
    FROM reference_ranges
    GROUP BY 1,2,3,4,5,6,7,8
    HAVING COUNT(*)>1
  ) s`;
  const { rows } = await pool.query(q);
  return { exists: true, duplicates: rows[0].dups };
}

async function countDuplicatesModern() {
  if (!(await tableExists('analysis_reference_ranges'))) return { exists: false };
  // Clave natural del índice único en moderno: param, sex, age_min, age_max, age_min_unit, lower, upper, text_value, unit, method
  const q = `SELECT COUNT(*)::int AS dups FROM (
    SELECT parameter_id,
           COALESCE(sex,'Ambos') AS sex,
           COALESCE(age_min,-1) AS age_min,
           COALESCE(age_max,-1) AS age_max,
           COALESCE(age_min_unit,'años') AS age_min_unit,
           COALESCE(lower,-999999) AS lower,
           COALESCE(upper,-999999) AS upper,
           COALESCE(text_value,'') AS text_value,
           COALESCE(unit,'') AS unit,
           COALESCE(method,'') AS method,
           COUNT(*)
    FROM analysis_reference_ranges
    GROUP BY 1,2,3,4,5,6,7,8,9,10
    HAVING COUNT(*)>1
  ) s`;
  const { rows } = await pool.query(q);
  return { exists: true, duplicates: rows[0].dups };
}

(async () => {
  const legacy = await countDuplicatesReferenceRanges();
  const modern = await countDuplicatesModern();
  const result = { reference_ranges: legacy, analysis_reference_ranges: modern };
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
  // Exit with non-zero if any duplicates are present so systemd can alert on failure
  const legacyDup = legacy.exists && legacy.duplicates > 0;
  const modernDup = modern.exists && modern.duplicates > 0;
  if (legacyDup || modernDup) {
    const parts = [];
    if (legacyDup) parts.push(`reference_ranges=${legacy.duplicates}`);
    if (modernDup) parts.push(`analysis_reference_ranges=${modern.duplicates}`);
    console.error(`Duplicate reference ranges detected: ${parts.join(', ')}`);
    process.exit(2);
  }
})().catch(async (e) => {
  console.error('ERROR', e);
  try { await pool.end(); } catch (closeErr) {
    // log minimal info to avoid empty block issues
    if (process.env.DEBUG) {
      console.error('Failed to close DB pool', closeErr?.message);
    }
  }
  process.exit(1);
});
