#!/usr/bin/env node
/**
 * Backfill de rangos de referencia para parámetros clave de Biometría Hemática
 * Uso: node server/scripts/backfillBiometriaHematicaRanges.js [--dry]
 * Requiere variables de conexión (igual que la app) y privilegios de escritura.
 */
const { pool } = require('../db');

const TARGET_NAMES = [
  { name:'VCM', unit:'fL', ranges:[ { sex:'Ambos', age_min:null, age_max:null, lower:80, upper:96 } ] },
  { name:'HCM', unit:'pg', ranges:[ { sex:'Ambos', age_min:null, age_max:null, lower:27, upper:33 } ] },
  { name:'Hemoglobina', unit:'g/dL', ranges:[ { sex:'Masculino', age_min:null, age_max:null, lower:13, upper:17 }, { sex:'Femenino', age_min:null, age_max:null, lower:12, upper:16 } ] }
];

async function run(){
  const dry = process.argv.includes('--dry');
  const client = await pool.connect();
  try {
    console.info('[BACKFILL][BH] start dry=%s', dry);
    await client.query('BEGIN');
    for (const target of TARGET_NAMES) {
      const { rows: params } = await client.query('SELECT id,name FROM analysis_parameters WHERE name=$1', [target.name]);
      for (const p of params) {
        const { rows: existing } = await client.query('SELECT id FROM reference_ranges WHERE parameter_id=$1 LIMIT 1',[p.id]);
        if (existing.length) {
          console.info('[BACKFILL][BH] skip %s (ya tiene rangos)', target.name);
          continue;
        }
        if (dry) {
          console.info('[BACKFILL][BH] DRY would insert %s ranges=%d', target.name, target.ranges.length);
          continue;
        }
        for (const r of target.ranges) {
          await client.query(`INSERT INTO reference_ranges(parameter_id,sex,age_min,age_max,lower,upper,age_min_unit) VALUES($1,$2,$3,$4,$5,$6,'años')`, [p.id, r.sex, r.age_min, r.age_max, r.lower, r.upper]);
        }
        console.info('[BACKFILL][BH] inserted %s ranges=%d', target.name, target.ranges.length);
      }
    }
    if (dry) await client.query('ROLLBACK'); else await client.query('COMMIT');
    console.info('[BACKFILL][BH] done');
  } catch(e){
    await client.query('ROLLBACK');
    console.error('[BACKFILL][BH] fail', e);
    process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
}

run();
