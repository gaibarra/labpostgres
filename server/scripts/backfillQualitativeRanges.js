#!/usr/bin/env node
/**
 * backfillQualitativeRanges.js
 * Inserta un rango cualitativo por defecto para parámetros que no tienen rangos.
 * Cubre esquema moderno (analysis_parameters/analysis_reference_ranges) y legacy (parameters/reference_ranges).
 * Idempotente: sólo afecta parámetros sin rangos existentes.
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* optional */ }

function clean(val){
  if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1);
  return val;
}

async function hasTable(pool, table){
  const { rows } = await pool.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
  return !!rows[0].t;
}

async function hasColumn(pool, table, column){
  const { rows } = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`, [table, column]);
  return !!rows[0];
}

async function backfillModern(pool){
  // Determinar columnas disponibles en analysis_reference_ranges
  const hasSex = await hasColumn(pool, 'analysis_reference_ranges', 'sex');
  const hasAgeMin = await hasColumn(pool, 'analysis_reference_ranges', 'age_min');
  const hasAgeMax = await hasColumn(pool, 'analysis_reference_ranges', 'age_max');
  const hasAgeUnit = await hasColumn(pool, 'analysis_reference_ranges', 'age_min_unit');
  const hasText = await hasColumn(pool, 'analysis_reference_ranges', 'text_value');
  const hasNotes = await hasColumn(pool, 'analysis_reference_ranges', 'notes');
  const hasUnit = await hasColumn(pool, 'analysis_reference_ranges', 'unit');
  const hasParamUnit = await hasColumn(pool, 'analysis_parameters', 'unit');

  const cols = ['parameter_id'];
  const sels = ['ap.id'];
  if (hasSex)     { cols.push('sex');          sels.push(`'Ambos'`); }
  if (hasAgeMin)  { cols.push('age_min');      sels.push(`NULL`); }
  if (hasAgeMax)  { cols.push('age_max');      sels.push(`NULL`); }
  if (hasAgeUnit) { cols.push('age_min_unit'); sels.push(`'años'`); }
  if (hasText)    { cols.push('text_value');   sels.push(`NULL`); }
  if (hasNotes)   { cols.push('notes');        sels.push(`'(Texto libre)'`); }
  if (hasUnit)    { cols.push('unit');         sels.push(hasParamUnit ? 'ap.unit' : 'NULL'); }

  const sql = `
    WITH ins AS (
      INSERT INTO analysis_reference_ranges(${cols.join(',')})
      SELECT ${sels.join(', ')}
      FROM analysis_parameters ap
      LEFT JOIN LATERAL (
        SELECT 1 FROM analysis_reference_ranges arr WHERE arr.parameter_id = ap.id LIMIT 1
      ) rr ON true
      WHERE rr IS NULL
      RETURNING 1
    ) SELECT count(*)::int AS inserted FROM ins;
  `;
  const { rows } = await pool.query(sql);
  return rows[0]?.inserted || 0;
}

async function backfillLegacy(pool){
  // Asumir columnas estándar legacy; insertar rango cualitativo por defecto
  const hasParams = await hasTable(pool, 'parameters');
  const hasRanges = await hasTable(pool, 'reference_ranges');
  if (!hasParams || !hasRanges) return 0;
  const sql = `
    WITH ins AS (
      INSERT INTO reference_ranges(
        parameter_id, sexo, edad_min, edad_max, edad_unit, valor_min, valor_max, tipo_valor, texto_permitido, texto_libre, notas
      )
      SELECT p.id, 'Ambos', NULL, NULL, 'años', NULL, NULL, 'textoLibre', '', NULL, '(Texto libre)'
      FROM parameters p
      LEFT JOIN LATERAL (
        SELECT 1 FROM reference_ranges rr WHERE rr.parameter_id = p.id LIMIT 1
      ) x ON true
      WHERE x IS NULL
      RETURNING 1
    ) SELECT count(*)::int AS inserted FROM ins;
  `;
  try {
    const { rows } = await pool.query(sql);
    return rows[0]?.inserted || 0;
  } catch (e) {
    console.warn('[BACKFILL][LEGACY] Saltando por error de columnas:', e.message);
    return 0;
  }
}

async function applyToDb(dbName){
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: clean(process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
    database: dbName
  });
  let inserted = 0;
  try {
    const modern = await hasTable(pool, 'analysis_parameters') && await hasTable(pool, 'analysis_reference_ranges');
    if (modern) {
      inserted = await backfillModern(pool);
      console.log('[BACKFILL][%s] Moderno: %d rangos cualitativos insertados', dbName, inserted);
    } else {
      inserted = await backfillLegacy(pool);
      console.log('[BACKFILL][%s] Legacy: %d rangos cualitativos insertados', dbName, inserted);
    }
  } catch (e) {
    console.error('[BACKFILL] Error en %s: %s', dbName, e.message);
  } finally {
    await pool.end();
  }
}

async function main(){
  const master = new Pool({
    host: process.env.MASTER_PGHOST || process.env.PGHOST,
    port: process.env.MASTER_PGPORT || process.env.PGPORT || 5432,
    user: process.env.MASTER_PGUSER || process.env.PGUSER,
    password: clean(process.env.MASTER_PGPASSWORD || process.env.PGPASSWORD),
    database: process.env.MASTER_PGDATABASE || process.env.MASTER_DB || 'lab_master'
  });
  try {
    const { rows } = await master.query('SELECT db_name FROM tenants WHERE status=$1', ['active']);
    if (!rows.length) { console.log('[BACKFILL] No hay tenants activos.'); return; }
    for (const r of rows) {
      await applyToDb(r.db_name);
    }
  } catch (e) {
    console.error('[BACKFILL] Error listando tenants:', e.message);
  } finally {
    await master.end();
  }
}

if (require.main === module) main();

module.exports = { applyToDb };
