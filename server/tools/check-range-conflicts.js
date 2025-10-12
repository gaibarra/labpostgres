#!/usr/bin/env node
/**
 * check-range-conflicts.js
 * Analiza las tablas de rangos de referencia y detecta:
 *  - Solapes de tramos de edad (intervalos deben ser contiguos o disjuntos, con semántica right-open)
 *  - Conflictos "Ambos" vs M/F por el mismo tramo (regla: si M y F difieren, no debe existir "Ambos")
 *  - Redundancias: presencia simultánea de M y F idénticos y "Ambos" para el mismo tramo (se prefiere "Ambos")
 *  - Inconsistencias obvias de formato (NaN en límites numéricos al normalizar)
 *
 * Salida: JSON con listas por parámetro y detalle de conflictos. Exit code 2 si hay conflictos.
 */
const { pool } = require('../db');

function normSex(s) {
  const v = (s || '').toString().trim().toLowerCase();
  if (v === 'm' || v === 'masculino' || v === 'male') return 'M';
  if (v === 'f' || v === 'femenino' || v === 'female') return 'F';
  return 'Ambos';
}

function asNum(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  const s = String(x).replace(/[^0-9.+\-eE]/g, '');
  const n = s === '' ? null : Number(s);
  return Number.isFinite(n) ? n : null;
}

function keyForGrouping(r) {
  // Agrupar por parámetro, unidad y método; el sexo se usa dentro de la validación
  return [r.parameter_id, r.unit || '', r.method || '', r.text_value || ''].join('::');
}

function sameValues(a, b) {
  return (
    asNum(a.lower) === asNum(b.lower) &&
    asNum(a.upper) === asNum(b.upper) &&
    (a.text_value || '') === (b.text_value || '') &&
    (a.unit || '') === (b.unit || '') &&
    (a.method || '') === (b.method || '')
  );
}

// Nota: había una función intervalOverlaps no usada; se elimina para evitar warnings.

async function tableExists(name) {
  const { rows } = await pool.query('SELECT to_regclass($1) AS t', [`public.${name}`]);
  return !!rows[0].t;
}

async function fetchRanges() {
  const out = [];
  // Helper para obtener columnas de una tabla
  const columnSet = async (table) => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    return new Set(rows.map(r => r.column_name));
  };
  if (await tableExists('reference_ranges')) {
    const cols = await columnSet('reference_ranges');
    const lowerCol = cols.has('lower') ? 'lower' : (cols.has('min_value') ? 'min_value' : 'NULL');
    const upperCol = cols.has('upper') ? 'upper' : (cols.has('max_value') ? 'max_value' : 'NULL');
    const ageMinCol = cols.has('age_min') ? 'age_min' : 'NULL';
    const ageMaxCol = cols.has('age_max') ? 'age_max' : 'NULL';
    const ageUnitCol = cols.has('age_min_unit') ? 'age_min_unit' : (cols.has('age_unit') ? 'age_unit' : `NULL`);
    const sexCol = cols.has('sex') ? 'sex' : `NULL`;
    const textCol = cols.has('text_value') ? 'text_value' : `''`;
    const unitCol = cols.has('unit') ? 'unit' : `''`;
    const methodCol = cols.has('method') ? 'method' : `''`;
    const { rows } = await pool.query(
      `SELECT parameter_id,
              COALESCE(${sexCol}, 'Ambos') AS sex,
              COALESCE(${ageMinCol}, 0) AS age_min,
              COALESCE(${ageMaxCol}, 120) AS age_max,
              COALESCE(${ageUnitCol}, 'años') AS age_min_unit,
              ${lowerCol} AS lower,
              ${upperCol} AS upper,
              COALESCE(${textCol}, '') AS text_value,
              COALESCE(${unitCol}, '') AS unit,
              COALESCE(${methodCol}, '') AS method,
              'legacy' AS source
       FROM reference_ranges`
    );
    for (const r of rows) out.push({ ...r, sex: normSex(r.sex) });
  }
  if (await tableExists('analysis_reference_ranges')) {
    const cols = await columnSet('analysis_reference_ranges');
    const lowerCol = cols.has('lower') ? 'lower' : 'NULL';
    const upperCol = cols.has('upper') ? 'upper' : 'NULL';
    const ageMinCol = cols.has('age_min') ? 'age_min' : 'NULL';
    const ageMaxCol = cols.has('age_max') ? 'age_max' : 'NULL';
    const ageUnitCol = cols.has('age_min_unit') ? 'age_min_unit' : (cols.has('age_unit') ? 'age_unit' : `NULL`);
    const sexCol = cols.has('sex') ? 'sex' : `NULL`;
    const textCol = cols.has('text_value') ? 'text_value' : `''`;
    const unitCol = cols.has('unit') ? 'unit' : `''`;
    const methodCol = cols.has('method') ? 'method' : `''`;
    const { rows } = await pool.query(
      `SELECT parameter_id,
              COALESCE(${sexCol}, 'Ambos') AS sex,
              COALESCE(${ageMinCol}, 0) AS age_min,
              COALESCE(${ageMaxCol}, 120) AS age_max,
              COALESCE(${ageUnitCol}, 'años') AS age_min_unit,
              ${lowerCol} AS lower,
              ${upperCol} AS upper,
              COALESCE(${textCol}, '') AS text_value,
              COALESCE(${unitCol}, '') AS unit,
              COALESCE(${methodCol}, '') AS method,
              'modern' AS source
       FROM analysis_reference_ranges`
    );
    for (const r of rows) out.push({ ...r, sex: normSex(r.sex) });
  }
  return out;
}

function analyzeConflicts(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = keyForGrouping(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const issues = [];
  const byParameter = new Map();

  // Paso A: chequeos existentes por grupo completo (incluye text_value)

  for (const [gkey, arr] of groups.entries()) {
    // Separar por tramo (age_min, age_max); y por sexo dentro de cada tramo
    const byTramo = new Map();
    for (const r of arr) {
      const aMin = asNum(r.age_min);
      const aMax = asNum(r.age_max);
      const tramoKey = `${aMin}..${aMax}`;
      if (!byTramo.has(tramoKey)) byTramo.set(tramoKey, []);
      byTramo.get(tramoKey).push(r);
      if (aMin === null || aMax === null) {
        issues.push({ type: 'invalid_age', message: 'age_min/age_max inválidos', row: r });
      }
      if (r.text_value === '' && (asNum(r.lower) === null || asNum(r.upper) === null)) {
        issues.push({ type: 'invalid_bounds', message: 'Límites numéricos no válidos', row: r });
      }
    }
    // Revisar overlaps entre tramos (independiente de sexo)
    const sorted = Array.from(byTramo.keys())
      .map(k => ({ key: k, min: asNum(k.split('..')[0]), max: asNum(k.split('..')[1]) }))
      .sort((a,b) => a.min - b.min || a.max - b.max);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1];
      const cur = sorted[i];
      if (prev.max > cur.min) {
        issues.push({ type: 'overlap_age', message: `Solape de tramos ${prev.key} y ${cur.key}`, group: gkey });
      }
    }
    // Conflictos de sexo dentro del mismo tramo
    for (const [tKey, items] of byTramo.entries()) {
      const ambos = items.filter(r => r.sex === 'Ambos');
      const males = items.filter(r => r.sex === 'M');
      const females = items.filter(r => r.sex === 'F');
      // Si existen M y F
      if (males.length && females.length) {
        // Comparar valores (esperamos uno por sexo tras dedupe)
        const m = males[0];
        const f = females[0];
        const equalMF = sameValues(m, f);
        if (!equalMF && ambos.length) {
          issues.push({ type: 'ambos_conflict', message: 'Existe Ambos junto con M/F diferentes', tramo: tKey, values: { m, f, ambos } });
        }
        if (equalMF && ambos.length) {
          issues.push({ type: 'redundant_mf_with_ambos', message: 'M y F idénticos pero también hay Ambos (redundante)', tramo: tKey, values: { m, f, ambos } });
        }
      }
      // Si no hay M/F pero hay Ambos está bien; si hay sólo M y Ambos (o F y Ambos), comprobar igualdad
      if (ambos.length && (males.length ^ females.length)) { // xor
        const a = ambos[0];
        const s = males.length ? males[0] : females[0];
        if (!sameValues(a, s)) {
          issues.push({ type: 'ambos_conflict_partial', message: 'Ambos y un solo sexo con valores distintos', tramo: tKey, values: { a, s } });
        } else {
          issues.push({ type: 'redundant_sex_with_ambos', message: 'Sexo único redundante con Ambos idéntico', tramo: tKey, values: { a, s } });
        }
      }
    }
  }

  // Paso B (preventivo): detectar huecos 0..120 por base sin texto (parameter_id+unit+method), uniendo todos los sexos y textos
  const byBaseNoText = new Map();
  for (const r of rows) {
    const base = [r.parameter_id, r.unit || '', r.method || ''].join('::');
    if (!byBaseNoText.has(base)) byBaseNoText.set(base, []);
    byBaseNoText.get(base).push(r);
  }
  for (const [bkey, arr] of byBaseNoText.entries()) {
    const intervals = arr
      .map(r => ({ s: asNum(r.age_min), e: asNum(r.age_max) }))
      .filter(it => it.s !== null && it.e !== null)
      .sort((a,b) => a.s - b.s || a.e - b.e);
    if (!intervals.length) {
      issues.push({ type: 'gap_age', message: 'Sin cobertura 0..120', group: bkey, gap: '0..120' });
      continue;
    }
    // fusionar
    const merged = [];
    for (const it of intervals) {
      if (!merged.length) { merged.push({ s: it.s, e: it.e }); continue; }
      const last = merged[merged.length - 1];
      if (it.s <= last.e) last.e = Math.max(last.e, it.e);
      else merged.push({ s: it.s, e: it.e });
    }
    // detectar huecos respecto a [0,120]
    const requiredStart = 0;
    const requiredEnd = 120;
    let cursor = requiredStart;
    for (const seg of merged) {
      if (seg.e <= requiredStart || seg.s >= requiredEnd) continue;
      const s = Math.max(seg.s, requiredStart);
      const e = Math.min(seg.e, requiredEnd);
      if (s > cursor) {
        issues.push({ type: 'gap_age', message: `Hueco ${cursor}..${s}`, group: bkey, gap: `${cursor}..${s}` });
      }
      cursor = Math.max(cursor, e);
      if (cursor >= requiredEnd) break;
    }
    if (cursor < requiredEnd) {
      issues.push({ type: 'gap_age', message: `Hueco ${cursor}..${requiredEnd}`, group: bkey, gap: `${cursor}..${requiredEnd}` });
    }
  }

  // Agrupar por parámetro para reporte
  for (const issue of issues) {
    const pid = issue.row?.parameter_id || issue.values?.m?.parameter_id || issue.values?.f?.parameter_id || issue.values?.ambos?.[0]?.parameter_id || issue.values?.a?.parameter_id || issue.values?.s?.parameter_id;
    const key = pid || 'unknown';
    if (!byParameter.has(key)) byParameter.set(key, []);
    byParameter.get(key).push(issue);
  }

  return { issues, byParameter };
}

(async () => {
  try {
    const rows = await fetchRanges();
    const { issues } = analyzeConflicts(rows);
    const summary = {
      total_ranges: rows.length,
      total_issues: issues.length,
      counts: issues.reduce((acc, it) => { acc[it.type] = (acc[it.type]||0)+1; return acc; }, {}),
      samples: issues.slice(0, 20) // muestra corta
    };
    console.log(JSON.stringify(summary, null, 2));
    await pool.end();
    if (issues.length > 0) process.exit(2);
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e);
    try { await pool.end(); } catch(closeErr) {
      if (process.env.DEBUG) console.error('Failed to close pool', closeErr?.message);
    }
    process.exit(1);
  }
})();
