#!/usr/bin/env node
/**
 * enforceHematologyCompleteness.js
 * Completa los rangos de Biometría Hemática (Hemoglobina, Hematocrito, Eritrocitos):
 * - Duplica filas con sexo 'Ambos' a 'Masculino' y 'Femenino' y elimina la fila 'Ambos'.
 * - Si existe sólo un sexo para una franja etaria, crea la del sexo faltante copiando valores.
 * - Respeta tabla moderna (analysis_reference_ranges) y legacy (reference_ranges).
 * - Dry-run por defecto; aplicar con --write.
 * Notas: No inventa nuevos valores numéricos; se limita a completar por sexo usando las filas existentes.
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(e) { /* optional .env */ }

function parseArgs(){
  const out = { write:false };
  for (const a of process.argv.slice(2)){
    if (a === '--write') out.write = true; else {
      const m = a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName) { console.error('Falta --db'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  const patterns = (args.like && String(args.like)) || 'Hemoglobina|Hematocrito|Eritrocitos';
  const report = { ok:true, matched:0, inserted:0, updated:0, deleted:0, items:[] };
  try {
    const hasTbl = async (t)=>{ const { rows } = await pool.query('SELECT to_regclass($1) AS t',[`public.${t}`]); return !!rows[0].t; };
    const hasModern = await hasTbl('analysis_reference_ranges');
    const hasLegacy = await hasTbl('reference_ranges');
    const targetTable = hasModern ? 'analysis_reference_ranges' : (hasLegacy ? 'reference_ranges' : null);
    if (!targetTable) {
      console.log(JSON.stringify({ ok:false, error:'No hay tablas de rangos' }));
      return;
    }
    const { rows: params } = await pool.query(`
      SELECT ap.id AS pid, ap.name AS pname, a.name AS aname
      FROM analysis a
      JOIN analysis_parameters ap ON ap.analysis_id=a.id
      WHERE ap.name ~* $1 OR a.name ~* $1
      ORDER BY a.name, ap.position NULLS LAST, ap.name
    `, [patterns]);
    report.matched = params.length;
    const meta = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [targetTable]);
    const cols = new Set(meta.rows.map(r=>r.column_name));
    const colLower = cols.has('lower') ? 'lower' : (cols.has('min_value') ? 'min_value' : null);
    const colUpper = cols.has('upper') ? 'upper' : (cols.has('max_value') ? 'max_value' : null);
    const colUnit  = cols.has('unit') ? 'unit' : null;
    const colText  = cols.has('text_value') ? 'text_value' : null;
    const colMethod= cols.has('method') ? 'method' : null;

    const bands = [ {min:0,max:1}, {min:1,max:12}, {min:12,max:18}, {min:18,max:120} ];
    const sexes = ['Masculino','Femenino'];

    for (const p of params){
      // cargar filas del parámetro
      const selCols = ['id','parameter_id','sex','age_min','age_max'];
      if (colLower) selCols.push(`${colLower} AS lower`);
      if (colUpper) selCols.push(`${colUpper} AS upper`);
      if (colUnit)  selCols.push(`${colUnit} AS unit`);
      if (colText)  selCols.push(`${colText} AS text_value`);
      if (colMethod) selCols.push(`${colMethod} AS method`);
      const { rows: ranges } = await pool.query(`SELECT ${selCols.join(', ')} FROM ${targetTable} WHERE parameter_id=$1`, [p.pid]);

      // indexar por franja (intersección exacta) y por sexo
  // const key = (s, b) => `${s}:${b.min}-${b.max}`;
      const getMatchForBand = (s, b) => {
        // buscar exacto por [age_min,age_max)
        const exact = ranges.find(r => (r.sex === s || r.sex === 'Ambos' || r.sex === 'O') && r.age_min === b.min && r.age_max === b.max);
        if (exact) return exact;
        // buscar overlapping por prioridad: mismo sexo -> Ambos -> otro sexo
        const overSame = ranges.find(r => r.sex === s && !(r.age_max <= b.min || r.age_min >= b.max));
        if (overSame) return overSame;
        const overAmbos = ranges.find(r => (r.sex === 'Ambos' || r.sex === 'O') && !(r.age_max <= b.min || r.age_min >= b.max));
        if (overAmbos) return overAmbos;
        const overOther = ranges.find(r => r.sex !== s && r.sex !== 'Ambos' && r.sex !== 'O' && !(r.age_max <= b.min || r.age_min >= b.max));
        if (overOther) return overOther;
        return null;
      };

      // 1) Duplicar filas 'Ambos' a M y F por banda
      for (const b of bands){
        const base = getMatchForBand('Ambos', b) || getMatchForBand('O', b);
        if (!base) continue;
        for (const s of sexes){
          const whereEq = ['parameter_id','sex','age_min','age_max'];
          const vals = [p.pid, s, b.min, b.max];
          if (colLower) { whereEq.push(colLower); vals.push(base.lower); }
          if (colUpper) { whereEq.push(colUpper); vals.push(base.upper); }
          if (colUnit)  { whereEq.push(colUnit);  vals.push(base.unit); }
          if (colText)  { whereEq.push(colText);  vals.push(base.text_value); }
          if (colMethod){ whereEq.push(colMethod); vals.push(base.method); }
          const whereSql = whereEq.map((c,i)=>`${c} IS NOT DISTINCT FROM $${i+1}`).join(' AND ');
          const { rows: exists } = await pool.query(`SELECT id FROM ${targetTable} WHERE ${whereSql} LIMIT 1`, vals);
          if (!exists.length){
            if (args.write) {
              const insCols = ['parameter_id','sex','age_min','age_max'];
              const insVals = [p.pid, s, b.min, b.max];
              const ph = ['$1','$2','$3','$4'];
              let idx=4;
              if (colLower){ insCols.push(colLower); insVals.push(base.lower); ph.push(`$${++idx}`); }
              if (colUpper){ insCols.push(colUpper); insVals.push(base.upper); ph.push(`$${++idx}`); }
              if (colUnit){  insCols.push(colUnit);  insVals.push(base.unit); ph.push(`$${++idx}`); }
              if (colText){  insCols.push(colText);  insVals.push(base.text_value); ph.push(`$${++idx}`); }
              if (colMethod){insCols.push(colMethod); insVals.push(base.method); ph.push(`$${++idx}`); }
              await pool.query(`INSERT INTO ${targetTable}(${insCols.join(',')}) VALUES (${ph.join(',')})`, insVals);
              report.inserted++;
              report.items.push({ action:'insert_from_ambos', parameter:p.pname, analysis:p.aname, sex:s, band:b });
            } else {
              report.items.push({ action:'would_insert_from_ambos', parameter:p.pname, analysis:p.aname, sex:s, band:b });
            }
          }
        }
      }

      // 2) Completar sexo faltante por banda copiando del sexo existente o del mejor match
      for (const b of bands){
        for (const s of sexes){
          const target = getMatchForBand(s, b);
          if (target && target.sex === s && target.age_min === b.min && target.age_max === b.max) continue; // ya existe exacto
          const source = target || getMatchForBand(s === 'Masculino' ? 'Femenino' : 'Masculino', b) || getMatchForBand('Ambos', b);
          if (!source) continue;
          // Evitar duplicar si ya existe cualquier fila exacta de s en banda (aunque difiera en valores)
          const { rows: anyExact } = await pool.query(`SELECT id FROM ${targetTable} WHERE parameter_id=$1 AND sex=$2 AND age_min=$3 AND age_max=$4 LIMIT 1`, [p.pid, s, b.min, b.max]);
          if (anyExact.length) continue;
          if (args.write) {
            const insCols = ['parameter_id','sex','age_min','age_max'];
            const insVals = [p.pid, s, b.min, b.max];
            const ph = ['$1','$2','$3','$4'];
            let idx=4;
            if (colLower){ insCols.push(colLower); insVals.push(source.lower); ph.push(`$${++idx}`); }
            if (colUpper){ insCols.push(colUpper); insVals.push(source.upper); ph.push(`$${++idx}`); }
            if (colUnit){  insCols.push(colUnit);  insVals.push(source.unit); ph.push(`$${++idx}`); }
            if (colText){  insCols.push(colText);  insVals.push(source.text_value); ph.push(`$${++idx}`); }
            if (colMethod){insCols.push(colMethod); insVals.push(source.method); ph.push(`$${++idx}`); }
            await pool.query(`INSERT INTO ${targetTable}(${insCols.join(',')}) VALUES (${ph.join(',')})`, insVals);
            report.inserted++;
            report.items.push({ action:'insert_missing_sex', parameter:p.pname, analysis:p.aname, sex:s, band:b });
          } else {
            report.items.push({ action:'would_insert_missing_sex', parameter:p.pname, analysis:p.aname, sex:s, band:b });
          }
        }
      }

      // 3) Eliminar filas 'Ambos' del parámetro (ya que completamos M/F)
      const { rows: ambosRows } = await pool.query(`SELECT id, age_min, age_max FROM ${targetTable} WHERE parameter_id=$1 AND (sex='Ambos' OR sex='O')`, [p.pid]);
      for (const ar of ambosRows){
        if (args.write) {
          await pool.query(`DELETE FROM ${targetTable} WHERE id=$1`, [ar.id]);
          report.deleted++;
          report.items.push({ action:'delete_ambos', parameter:p.pname, analysis:p.aname, band:{min:ar.age_min,max:ar.age_max} });
        } else {
          report.items.push({ action:'would_delete_ambos', parameter:p.pname, analysis:p.aname, band:{min:ar.age_min,max:ar.age_max} });
        }
      }
    }

    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    console.error('ERROR enforceHematologyCompleteness:', e.message);
    process.exit(1);
  } finally {
    await pool.end().catch(()=>{});
  }
}

if (require.main === module) main();
