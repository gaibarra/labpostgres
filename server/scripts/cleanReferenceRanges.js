#!/usr/bin/env node
/**
 * cleanReferenceRanges.js
 * Limpieza transaccional de rangos de referencia "legacy" y modernos:
 *  - Normaliza valores de sexo a 'Ambos' | 'Masculino' | 'Femenino'
 *  - Elimina filas inválidas con texto vacío y límites numéricos nulos
 *  - Elimina tramos 0..120 redundantes cuando existen tramos específicos
 *  - Deduplica M/F idénticos cuando existe 'Ambos' con mismos valores en el mismo tramo
 *
 * Uso:
 *   node scripts/cleanReferenceRanges.js           # dry-run (ROLLBACK)
 *   node scripts/cleanReferenceRanges.js --apply   # aplica cambios (COMMIT)
 */
const { pool } = require('../db');

async function tableExists(client, name) {
  const { rows } = await client.query('SELECT to_regclass($1) AS t', [`public.${name}`]);
  return !!rows[0].t;
}

async function getColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  const set = new Set(rows.map(r => r.column_name));
  const pick = (cands, fallback = null) => cands.find(c => set.has(c)) || fallback;
  return {
    id: pick(['id']),
    parameter_id: pick(['parameter_id']),
    sex: pick(['sex']),
    age_min: pick(['age_min']),
    age_max: pick(['age_max']),
    age_unit: pick(['age_min_unit', 'age_unit']),
    lower: pick(['lower', 'min_value']),
    upper: pick(['upper', 'max_value']),
    text_value: pick(['text_value']),
    unit: pick(['unit']),
    method: pick(['method'])
  };
}

async function normalizeSex(client, table, cols) {
  if (!cols.sex) return { updated: 0 };
  const { rowCount } = await client.query(
    `UPDATE ${table} SET ${cols.sex} = CASE
        WHEN LOWER(${cols.sex}) IN ('m','masculino','male') THEN 'Masculino'
        WHEN LOWER(${cols.sex}) IN ('f','femenino','female') THEN 'Femenino'
        ELSE 'Ambos'
      END
      WHERE ${cols.sex} IS NOT NULL
        AND ${cols.sex} NOT IN ('Ambos','Masculino','Femenino')`
  );
  return { updated: rowCount };
}

async function deleteInvalidNumericRows(client, table, cols) {
  if (!cols.lower || !cols.upper) return { deleted: 0 };
  const textCol = cols.text_value ? cols.text_value : null;
  const whereTextEmpty = textCol ? `COALESCE(${textCol}, '') = '' AND` : '';
  const { rowCount } = await client.query(
    `DELETE FROM ${table}
     WHERE ${whereTextEmpty}
           (${cols.lower} IS NULL OR ${cols.upper} IS NULL)`
  );
  return { deleted: rowCount };
}

async function deleteRedundantFullSpan(client, table, cols) {
  // Elimina filas 0..120 cuando hay otros tramos para mismo (parameter_id, unit, method, text_value)
  if (!cols.age_min || !cols.age_max || !cols.parameter_id) return { deleted: 0 };
  const unitEq = cols.unit ? `COALESCE(o.${cols.unit}, '') = COALESCE(t.${cols.unit}, '')` : 'TRUE';
  const methodEq = cols.method ? `COALESCE(o.${cols.method}, '') = COALESCE(t.${cols.method}, '')` : 'TRUE';
  const textEq = cols.text_value ? `COALESCE(o.${cols.text_value}, '') = COALESCE(t.${cols.text_value}, '')` : 'TRUE';
  const { rowCount } = await client.query(
    `DELETE FROM ${table} t
     WHERE ${cols.age_min} = 0 AND ${cols.age_max} = 120
       AND EXISTS (
         SELECT 1 FROM ${table} o
         WHERE o.${cols.parameter_id} = t.${cols.parameter_id}
           AND ${unitEq}
           AND ${methodEq}
           AND ${textEq}
           AND (o.${cols.age_min} <> 0 OR o.${cols.age_max} <> 120)
       )`
  );
  return { deleted: rowCount };
}

async function dedupeSexWithAmbos(client, table, cols) {
  // Elimina M/F si existe 'Ambos' idéntico en mismo tramo (mismo base key)
  if (!cols.sex || !cols.age_min || !cols.age_max || !cols.parameter_id) return { deleted: 0 };
  const unitEq = cols.unit ? `COALESCE(t.${cols.unit}, '') = COALESCE(a.${cols.unit}, '')` : 'TRUE';
  const methodEq = cols.method ? `COALESCE(t.${cols.method}, '') = COALESCE(a.${cols.method}, '')` : 'TRUE';
  const textEq = cols.text_value ? `COALESCE(t.${cols.text_value}, '') = COALESCE(a.${cols.text_value}, '')` : 'TRUE';
  const lowerCol = cols.lower ? cols.lower : null;
  const upperCol = cols.upper ? cols.upper : null;
  if (!lowerCol || !upperCol) return { deleted: 0 };
  const { rowCount } = await client.query(
    `DELETE FROM ${table} t
     USING ${table} a
     WHERE t.${cols.sex} IN ('Masculino','Femenino')
       AND a.${cols.sex} = 'Ambos'
       AND t.${cols.parameter_id} = a.${cols.parameter_id}
       AND t.${cols.age_min} = a.${cols.age_min}
       AND t.${cols.age_max} = a.${cols.age_max}
       AND ${unitEq}
       AND ${methodEq}
       AND ${textEq}
       AND COALESCE(t.${lowerCol}, -1e309) = COALESCE(a.${lowerCol}, -1e309)
       AND COALESCE(t.${upperCol}, 1e309) = COALESCE(a.${upperCol}, 1e309)`
  );
  return { deleted: rowCount };
}

async function run() {
  const apply = process.argv.includes('--apply');
  const client = await pool.connect();
  const summary = { apply, tables: {} };
  try {
    await client.query('BEGIN');

    for (const table of ['reference_ranges', 'analysis_reference_ranges']) {
      if (!(await tableExists(client, table))) continue;
      const cols = await getColumns(client, table);
      summary.tables[table] = {};

      const sexRes = await normalizeSex(client, table, cols);
      summary.tables[table].normalize_sex = sexRes;

      const delInvalid = await deleteInvalidNumericRows(client, table, cols);
      summary.tables[table].delete_invalid_numeric = delInvalid;

      const delFullSpan = await deleteRedundantFullSpan(client, table, cols);
      summary.tables[table].delete_redundant_fullspan = delFullSpan;

      const delDedupe = await dedupeSexWithAmbos(client, table, cols);
      summary.tables[table].dedupe_sex_with_ambos = delDedupe;

      // Eliminar superset 18..120 o 0..120 cubiertos por partición contigua (ej. 18..50 + 50..120)
      if (cols.age_min && cols.age_max && cols.parameter_id) {
        const unitEqL = cols.unit ? `COALESCE(l.${cols.unit}, '') = COALESCE(t.${cols.unit}, '')` : 'TRUE';
        const unitEqR = cols.unit ? `COALESCE(r.${cols.unit}, '') = COALESCE(t.${cols.unit}, '')` : 'TRUE';
        const methodEqL = cols.method ? `COALESCE(l.${cols.method}, '') = COALESCE(t.${cols.method}, '')` : 'TRUE';
        const methodEqR = cols.method ? `COALESCE(r.${cols.method}, '') = COALESCE(t.${cols.method}, '')` : 'TRUE';
        const textEqL = cols.text_value ? `COALESCE(l.${cols.text_value}, '') = COALESCE(t.${cols.text_value}, '')` : 'TRUE';
        const textEqR = cols.text_value ? `COALESCE(r.${cols.text_value}, '') = COALESCE(t.${cols.text_value}, '')` : 'TRUE';
        const lowerEqL = cols.lower ? `COALESCE(l.${cols.lower}, -1e309) = COALESCE(t.${cols.lower}, -1e309)` : 'TRUE';
        const lowerEqR = cols.lower ? `COALESCE(r.${cols.lower}, -1e309) = COALESCE(t.${cols.lower}, -1e309)` : 'TRUE';
        const upperEqL = cols.upper ? `COALESCE(l.${cols.upper}, 1e309) = COALESCE(t.${cols.upper}, 1e309)` : 'TRUE';
        const upperEqR = cols.upper ? `COALESCE(r.${cols.upper}, 1e309) = COALESCE(t.${cols.upper}, 1e309)` : 'TRUE';
        const sexEqL = cols.sex ? `COALESCE(l.${cols.sex}, 'Ambos') = COALESCE(t.${cols.sex}, 'Ambos')` : 'TRUE';
        const sexEqR = cols.sex ? `COALESCE(r.${cols.sex}, 'Ambos') = COALESCE(t.${cols.sex}, 'Ambos')` : 'TRUE';
        const sql = `
          DELETE FROM ${table} t
          WHERE (t.${cols.age_min}, t.${cols.age_max}) IN ((0,120),(18,120))
            AND EXISTS (
              SELECT 1 FROM ${table} l
              WHERE l.${cols.parameter_id} = t.${cols.parameter_id}
                AND ${unitEqL} AND ${methodEqL} AND ${textEqL} AND ${sexEqL}
                AND l.${cols.age_min} = t.${cols.age_min} AND l.${cols.age_max} < t.${cols.age_max}
                AND ${lowerEqL} AND ${upperEqL}
            )
            AND EXISTS (
              SELECT 1 FROM ${table} r
              WHERE r.${cols.parameter_id} = t.${cols.parameter_id}
                AND ${unitEqR} AND ${methodEqR} AND ${textEqR} AND ${sexEqR}
                AND r.${cols.age_min} > t.${cols.age_min} AND r.${cols.age_max} = t.${cols.age_max}
                AND ${lowerEqR} AND ${upperEqR}
            )
        `;
        const { rowCount } = await client.query(sql);
        summary.tables[table].delete_superset = { deleted: rowCount };
      }

        // Consolidar adultos: 18..65 + 65..120 => 18..120 (mismos valores y metadatos)
        if (cols.age_min && cols.age_max && cols.parameter_id) {
          const unitEq = cols.unit ? (a,b) => `COALESCE(${a}.${cols.unit}, '') = COALESCE(${b}.${cols.unit}, '')` : () => 'TRUE';
          const methodEq = cols.method ? (a,b) => `COALESCE(${a}.${cols.method}, '') = COALESCE(${b}.${cols.method}, '')` : () => 'TRUE';
          const textEq = cols.text_value ? (a,b) => `COALESCE(${a}.${cols.text_value}, '') = COALESCE(${b}.${cols.text_value}, '')` : () => 'TRUE';
          const sexEq = cols.sex ? (a,b) => `COALESCE(${a}.${cols.sex}, 'Ambos') = COALESCE(${b}.${cols.sex}, 'Ambos')` : () => 'TRUE';
          const lowerEq = cols.lower ? (a,b) => `COALESCE(${a}.${cols.lower}, -1e309) = COALESCE(${b}.${cols.lower}, -1e309)` : () => 'TRUE';
          const upperEq = cols.upper ? (a,b) => `COALESCE(${a}.${cols.upper}, 1e309) = COALESCE(${b}.${cols.upper}, 1e309)` : () => 'TRUE';

          // 1) Update: extender 18..65 -> 18..120 cuando exista 65..120 equivalente
          const updateSql = `
            UPDATE ${table} l
            SET ${cols.age_max} = 120
            FROM ${table} r
            WHERE l.${cols.parameter_id} = r.${cols.parameter_id}
              AND l.${cols.age_min} = 18 AND l.${cols.age_max} = 65
              AND r.${cols.age_min} = 65 AND r.${cols.age_max} = 120
              AND ${unitEq('l','r')} AND ${methodEq('l','r')} AND ${textEq('l','r')} AND ${sexEq('l','r')}
              AND ${lowerEq('l','r')} AND ${upperEq('l','r')}
          `;
          const updRes = await client.query(updateSql);
          summary.tables[table].consolidate_adults_update = { updated: updRes.rowCount };

          // 2) Delete: eliminar 65..120 cuando ya existe 18..120 equivalente
          const deleteSql = `
            DELETE FROM ${table} r
            USING ${table} l
            WHERE r.${cols.parameter_id} = l.${cols.parameter_id}
              AND r.${cols.age_min} = 65 AND r.${cols.age_max} = 120
              AND l.${cols.age_min} = 18 AND l.${cols.age_max} = 120
              AND ${unitEq('l','r')} AND ${methodEq('l','r')} AND ${textEq('l','r')} AND ${sexEq('l','r')}
              AND ${lowerEq('l','r')} AND ${upperEq('l','r')}
          `;
          const delRes = await client.query(deleteSql);
          summary.tables[table].consolidate_adults_delete = { deleted: delRes.rowCount };
        }

        // Regla pediátrica: eliminar 0..120 si existen 0..1 y 1..2 con mismos valores/sexo/base
        if (cols.age_min && cols.age_max && cols.parameter_id) {
          const unitEq = cols.unit ? (a,b) => `COALESCE(${a}.${cols.unit}, '') = COALESCE(${b}.${cols.unit}, '')` : () => 'TRUE';
          const methodEq = cols.method ? (a,b) => `COALESCE(${a}.${cols.method}, '') = COALESCE(${b}.${cols.method}, '')` : () => 'TRUE';
          const textEq = cols.text_value ? (a,b) => `COALESCE(${a}.${cols.text_value}, '') = COALESCE(${b}.${cols.text_value}, '')` : () => 'TRUE';
          const sexEq = cols.sex ? (a,b) => `COALESCE(${a}.${cols.sex}, 'Ambos') = COALESCE(${b}.${cols.sex}, 'Ambos')` : () => 'TRUE';
          const lowerEq = cols.lower ? (a,b) => `COALESCE(${a}.${cols.lower}, -1e309) = COALESCE(${b}.${cols.lower}, -1e309)` : () => 'TRUE';
          const upperEq = cols.upper ? (a,b) => `COALESCE(${a}.${cols.upper}, 1e309) = COALESCE(${b}.${cols.upper}, 1e309)` : () => 'TRUE';

          const delete0120Sql = `
            DELETE FROM ${table} x
            WHERE x.${cols.age_min} = 0 AND x.${cols.age_max} = 120
              AND EXISTS (
                SELECT 1 FROM ${table} a
                WHERE a.${cols.parameter_id} = x.${cols.parameter_id}
                  AND a.${cols.age_min} = 0 AND a.${cols.age_max} = 1
                  AND ${unitEq('a','x')} AND ${methodEq('a','x')} AND ${textEq('a','x')} AND ${sexEq('a','x')}
                  AND ${lowerEq('a','x')} AND ${upperEq('a','x')}
              )
              AND EXISTS (
                SELECT 1 FROM ${table} b
                WHERE b.${cols.parameter_id} = x.${cols.parameter_id}
                  AND b.${cols.age_min} = 1 AND b.${cols.age_max} = 2
                  AND ${unitEq('b','x')} AND ${methodEq('b','x')} AND ${textEq('b','x')} AND ${sexEq('b','x')}
                  AND ${lowerEq('b','x')} AND ${upperEq('b','x')}
              )
          `;
          const del0120 = await client.query(delete0120Sql);
          summary.tables[table].delete_0_120_when_0_1_and_1_2 = { deleted: del0120.rowCount };
        }

        // Variante: eliminar 0..120 (Ambos) si 0..1 y 1..2 tienen M y F idénticos y coinciden con 0..120
        if (cols.age_min && cols.age_max && cols.parameter_id && cols.sex) {
          const unitEq = cols.unit ? (a,b) => `COALESCE(${a}.${cols.unit}, '') = COALESCE(${b}.${cols.unit}, '')` : () => 'TRUE';
          const methodEq = cols.method ? (a,b) => `COALESCE(${a}.${cols.method}, '') = COALESCE(${b}.${cols.method}, '')` : () => 'TRUE';
          const textEq = cols.text_value ? (a,b) => `COALESCE(${a}.${cols.text_value}, '') = COALESCE(${b}.${cols.text_value}, '')` : () => 'TRUE';
          const lowerEq = cols.lower ? (a,b) => `COALESCE(${a}.${cols.lower}, -1e309) = COALESCE(${b}.${cols.lower}, -1e309)` : () => 'TRUE';
          const upperEq = cols.upper ? (a,b) => `COALESCE(${a}.${cols.upper}, 1e309) = COALESCE(${b}.${cols.upper}, 1e309)` : () => 'TRUE';

          const deleteAmbos0120 = `
            DELETE FROM ${table} x
            WHERE x.${cols.age_min} = 0 AND x.${cols.age_max} = 120 AND x.${cols.sex} = 'Ambos'
              AND EXISTS (
                SELECT 1 FROM ${table} am
                JOIN ${table} af ON af.${cols.parameter_id} = x.${cols.parameter_id}
                  AND af.${cols.age_min} = 0 AND af.${cols.age_max} = 1 AND af.${cols.sex} = 'Femenino'
                  AND ${unitEq('af','x')} AND ${methodEq('af','x')} AND ${textEq('af','x')}
                  AND ${lowerEq('af','am')} AND ${upperEq('af','am')}
                  AND ${lowerEq('af','x')} AND ${upperEq('af','x')}
                WHERE am.${cols.parameter_id} = x.${cols.parameter_id}
                  AND am.${cols.age_min} = 0 AND am.${cols.age_max} = 1 AND am.${cols.sex} = 'Masculino'
                  AND ${unitEq('am','x')} AND ${methodEq('am','x')} AND ${textEq('am','x')}
              )
              AND EXISTS (
                SELECT 1 FROM ${table} bm
                JOIN ${table} bf ON bf.${cols.parameter_id} = x.${cols.parameter_id}
                  AND bf.${cols.age_min} = 1 AND bf.${cols.age_max} = 2 AND bf.${cols.sex} = 'Femenino'
                  AND ${unitEq('bf','x')} AND ${methodEq('bf','x')} AND ${textEq('bf','x')}
                  AND ${lowerEq('bf','bm')} AND ${upperEq('bf','bm')}
                  AND ${lowerEq('bf','x')} AND ${upperEq('bf','x')}
                WHERE bm.${cols.parameter_id} = x.${cols.parameter_id}
                  AND bm.${cols.age_min} = 1 AND bm.${cols.age_max} = 2 AND bm.${cols.sex} = 'Masculino'
                  AND ${unitEq('bm','x')} AND ${methodEq('bm','x')} AND ${textEq('bm','x')}
              )
          `;
          const delAmbos = await client.query(deleteAmbos0120);
          summary.tables[table].delete_ambos_0_120_when_mf_children_equal = { deleted: delAmbos.rowCount };
        }
    }

    if (apply) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
  } catch (e) {
    summary.error = e.message;
    try { await client.query('ROLLBACK'); } catch(_) { /* ignore rollback error */ }
    throw e;
  } finally {
    client.release();
  }
  return summary;
}

(async () => {
  try {
    const res = await run();
    console.log(JSON.stringify(res, null, 2));
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('[CLEAN-RANGES] ERROR:', e);
    try { await pool.end(); } catch(_) { /* ignore pool close error */ }
    process.exit(1);
  }
})();
