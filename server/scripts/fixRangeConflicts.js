#!/usr/bin/env node
/**
 * fixRangeConflicts.js
 * Aplica correcciones seguras a rangos modernos (analysis_reference_ranges) y rellena huecos 0–120.
 * - Colapsa redundancias M/F vs Ambos.
 * - Elimina tramos coarse o solapes ajustando age_min.
 * - Marca texto en filas sin límites numéricos.
 * - Rellena huecos 0–120 con valores numéricos derivados de tramos cercanos; usa texto sólo si no hay referencia numérica.
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(e) { if (process.env.DEBUG) console.warn('dotenv skipped'); }

function clean(val){ if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1); return val; }
function normSex(s){ const v=(s||'').toString().trim().toLowerCase(); if(v==='m'||v==='masculino'||v==='male')return 'M'; if(v==='f'||v==='femenino'||v==='female')return 'F'; return 'Ambos'; }
function asNum(x){ if(x===null||x===undefined)return null; if(typeof x==='number')return Number.isFinite(x)?x:null; const s=String(x).replace(/[^0-9.+\-eE]/g,''); const n=s===''?null:Number(s); return Number.isFinite(n)?n:null; }
function sameValues(a,b){ return String(a.unit||'')===String(b.unit||'') && String(a.method||'')===String(b.method||'') && String(a.text_value||'')===String(b.text_value||'') && asNum(a.lower)===asNum(b.lower) && asNum(a.upper)===asNum(b.upper); }
function groupKey(r){ return [r.parameter_id, r.age_min, r.age_max, r.age_min_unit||'años', r.unit||'', r.method||'', r.text_value||''].join('::'); }
async function hasTable(pool, table){ const { rows }=await pool.query('SELECT to_regclass($1) AS t',[`public.${table}`]); return !!rows[0].t; }

async function run(dbName){
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: clean(process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
    database: dbName
  });
  const changes = { deleteAmbos: 0, deleteSexes: 0, deleteWide: 0, markText: 0, legacyMarkText: 0 };
  try {
    const modern = await hasTable(pool, 'analysis_reference_ranges');
    if (modern) {
      const { rows } = await pool.query(`
        SELECT id, parameter_id, COALESCE(sex,'Ambos') AS sex,
               COALESCE(age_min,0) AS age_min, COALESCE(age_max,120) AS age_max,
               COALESCE(age_min_unit,'años') AS age_min_unit,
               lower, upper, COALESCE(text_value,'') AS text_value,
               COALESCE(unit,'') AS unit, COALESCE(method,'') AS method
        FROM analysis_reference_ranges`);
      const byGroup = new Map();
      for (const r of rows) {
        const key = groupKey(r);
        if (!byGroup.has(key)) byGroup.set(key, []);
        byGroup.get(key).push({ ...r, sex: normSex(r.sex) });
      }
      const delIds = new Set();
      const markIds = new Set();
      const updAgeMin = [];

      // PASADA CRUZADA sin sexo: recorte determinista right-open
      const baseNoSex = new Map();
      for (const r of rows) {
        const base = [r.parameter_id, r.unit||'', r.method||'', (r.text_value||'')].join('::');
        if (!baseNoSex.has(base)) baseNoSex.set(base, []);
        baseNoSex.get(base).push({ id: r.id, a0: asNum(r.age_min), a1: asNum(r.age_max) });
      }
      for (const list of baseNoSex.values()){
        const sorted = list.filter(x=>x.a0!==null&&x.a1!==null).sort((a,b)=>(a.a0-b.a0)||(a.a1-b.a1));
        let frontier = -Infinity;
        for (const cand of sorted){
          if (delIds.has(cand.id)) continue;
          if (cand.a0 < frontier){
            if (cand.a1 <= frontier){ delIds.add(cand.id); continue; }
            updAgeMin.push({ id: cand.id, newMin: frontier });
            cand.a0 = frontier;
          }
          frontier = Math.max(frontier, cand.a1);
        }
      }

      // Regla Ambos/MF + marcar texto vacío cuando faltan límites numéricos
      for (const list of byGroup.values()){
        const males = list.filter(r=>r.sex==='M');
        const females = list.filter(r=>r.sex==='F');
        const ambos = list.filter(r=>r.sex==='Ambos');
        if (males.length && females.length && ambos.length){
          const m=males[0], f=females[0];
          if (sameValues(m,f)){
            for (const x of males.concat(females)) delIds.add(x.id);
            changes.deleteSexes += males.length + females.length;
          } else {
            for (const a of ambos) delIds.add(a.id);
            changes.deleteAmbos += ambos.length;
          }
        }
        for (const r of list){
          const lbMissing = (r.lower===null || r.lower===undefined);
          const ubMissing = (r.upper===null || r.upper===undefined);
          if ((lbMissing||ubMissing) && (!r.text_value || !r.text_value.trim())) markIds.add(r.id);
        }
      }

      // Eliminar coarse/recorte por base+sexo
      const baseGroup = new Map();
      for (const r of rows){
        const sx = normSex(r.sex);
        const base = [r.parameter_id, sx, r.unit||'', r.method||'', r.text_value||''].join('::');
        if (!baseGroup.has(base)) baseGroup.set(base, []);
        baseGroup.get(base).push({ ...r, sex: sx, a0: asNum(r.age_min), a1: asNum(r.age_max) });
      }
      for (const list of baseGroup.values()){
        const sorted = list.slice().sort((a,b)=>(a.a0-b.a0)||(a.a1-b.a1));
        const wide = sorted.filter(r=>r.a0===0 && r.a1===120);
        if (wide.length && list.length > wide.length){ for (const w of wide){ delIds.add(w.id); changes.deleteWide++; } }
        for (const cand of sorted){
          if (delIds.has(cand.id)) continue;
          const innerAny = sorted.find(x=>x.id!==cand.id && x.a0!==null && x.a1!==null && x.a0>=cand.a0 && x.a1<=cand.a1 && (x.a0>cand.a0 || x.a1<cand.a1));
          if (innerAny){ delIds.add(cand.id); changes.deleteWide++; }
        }
        for (const cand of sorted){
          if (delIds.has(cand.id)) continue;
          const inner = sorted.filter(x=>x.id!==cand.id && x.a0!==null && x.a1!==null && x.a0>=cand.a0 && x.a1<=cand.a1);
          if (inner.length < 2) continue;
          const merged = [];
          inner.sort((a,b)=>(a.a0-b.a0)||(a.a1-b.a1));
          for (const it of inner){
            if (!merged.length){ merged.push({ s: it.a0, e: it.a1 }); continue; }
            const last = merged[merged.length-1];
            if (it.a0 <= last.e) last.e = Math.max(last.e, it.a1); else merged.push({ s: it.a0, e: it.a1 });
          }
          let ok = false; let cursor = cand.a0;
          if (merged.length && merged[0].s <= cand.a0 && merged[merged.length-1].e >= cand.a1){
            ok = true;
            for (const seg of merged){
              if (seg.e <= cand.a0 || seg.s >= cand.a1) continue;
              const s = Math.max(seg.s, cand.a0); const e = Math.min(seg.e, cand.a1);
              if (s > cursor){ ok = false; break; }
              cursor = Math.max(cursor, e); if (cursor >= cand.a1) break;
            }
          }
          if (ok && cursor >= cand.a1){ delIds.add(cand.id); changes.deleteWide++; }
          else if (cursor > cand.a0){ if (cursor >= cand.a1) delIds.add(cand.id); else { updAgeMin.push({ id: cand.id, newMin: cursor }); cand.a0 = cursor; } }
        }
        let frontier = -Infinity;
        for (const cand of sorted){
          if (delIds.has(cand.id)) continue;
          if (cand.a0 < frontier){ if (cand.a1 <= frontier){ delIds.add(cand.id); continue; }
            updAgeMin.push({ id: cand.id, newMin: frontier }); cand.a0 = frontier; }
          frontier = Math.max(frontier, cand.a1);
        }
      }

      await pool.query('BEGIN');
      // Correcciones numéricas obvias y aplicación de deletes/updates
  try { await pool.query(`UPDATE analysis_reference_ranges SET age_min = age_max, age_max = age_min WHERE age_min IS NOT NULL AND age_max IS NOT NULL AND age_min > age_max`); } catch(err){ if (process.env.DEBUG) console.warn('swap age_min/age_max skipped', err && err.message); }
  try { await pool.query(`UPDATE analysis_reference_ranges SET lower = upper, upper = lower WHERE lower IS NOT NULL AND upper IS NOT NULL AND lower > upper`); } catch(err){ if (process.env.DEBUG) console.warn('swap lower/upper skipped', err && err.message); }
      if (updAgeMin.length){ for (const ch of updAgeMin){ await pool.query(`UPDATE analysis_reference_ranges SET age_min = $2 WHERE id = $1`, [ch.id, ch.newMin]); } }
      if (delIds.size){ await pool.query(`DELETE FROM analysis_reference_ranges WHERE id = ANY($1::uuid[])`, [Array.from(delIds)]); }
      if (markIds.size){ await pool.query(`UPDATE analysis_reference_ranges SET text_value='(Texto libre)' WHERE id = ANY($1::uuid[])`, [Array.from(markIds)]); changes.markText += markIds.size; }

      // Relleno de huecos 0–120 por base (parameter_id+unit+method) con valores numéricos si existen.
      const { rows: fresh } = await pool.query(`
        SELECT id, parameter_id, COALESCE(sex,'Ambos') AS sex,
               COALESCE(age_min,0) AS age_min, COALESCE(age_max,120) AS age_max,
               COALESCE(unit,'') AS unit, COALESCE(method,'') AS method,
               lower, upper, COALESCE(text_value,'') AS text_value
        FROM analysis_reference_ranges`);
      const baseMapFill = new Map();
      for (const r0 of fresh){
        const r = { ...r0, sex: normSex(r0.sex), s: asNum(r0.age_min), e: asNum(r0.age_max), lb: asNum(r0.lower), ub: asNum(r0.upper) };
        const base = [r.parameter_id, r.unit, r.method].join('::');
        if (!baseMapFill.has(base)) baseMapFill.set(base, []);
        baseMapFill.get(base).push(r);
      }
      const nearestRef = (rows, targetS, preferSex = null) => {
        const poolRows = rows.filter(r => r.lb !== null && r.ub !== null && (!preferSex || r.sex === preferSex));
        if (!poolRows.length && preferSex) return nearestRef(rows, targetS, null);
        const left = poolRows.filter(r=>r.e!==null && r.e<=targetS).sort((a,b)=> b.e-a.e)[0];
        if (left) return left;
        const right = poolRows.filter(r=>r.s!==null && r.s>=targetS).sort((a,b)=> a.s-b.s)[0];
        return right || null;
      };
      const hasSexDifferences = (rows) => {
        const mVals = new Set(rows.filter(r=>r.sex==='M' && r.lb!==null && r.ub!==null).map(r=>`${r.lb}..${r.ub}`));
        const fVals = new Set(rows.filter(r=>r.sex==='F' && r.lb!==null && r.ub!==null).map(r=>`${r.lb}..${r.ub}`));
        if (!mVals.size || !fVals.size) return false; if (mVals.size !== fVals.size) return true; for (const v of mVals) if (!fVals.has(v)) return true; return false;
      };
      let inserted = 0;
      for (const arrAll of baseMapFill.values()){
        const intervals = arrAll.map(r=>({ s:r.s, e:r.e })).filter(it=>it.s!==null && it.e!==null).sort((a,b)=>(a.s-b.s)||(a.e-b.e));
        const unit = arrAll[0].unit; const method = arrAll[0].method; const pid = arrAll[0].parameter_id;
        if (!intervals.length){
          const ref = nearestRef(arrAll, 0, 'Ambos') || nearestRef(arrAll, 0, null);
          if (ref && ref.lb!==null && ref.ub!==null){
            const res = await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
              VALUES ($1,'Ambos',0,120,'años',$2,$3,'',$4,$5) ON CONFLICT DO NOTHING`, [pid, unit, method, ref.lb, ref.ub]);
            inserted += res.rowCount || 0;
          } else {
            const res = await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
              VALUES ($1,'Ambos',0,120,'años',$2,$3,'(Texto libre)',NULL,NULL) ON CONFLICT DO NOTHING`, [pid, unit, method]);
            inserted += res.rowCount || 0;
          }
          continue;
        }
        const reqS=0, reqE=120; let cursor=reqS; const sexDiff = hasSexDifferences(arrAll);
        for (const seg of intervals){
          if (seg.e<=reqS || seg.s>=reqE) continue; const s=Math.max(seg.s, reqS); const e=Math.min(seg.e, reqE);
          if (s>cursor){
            if (sexDiff){
              const refM = nearestRef(arrAll.filter(r=>r.sex==='M'), cursor, 'M');
              const refF = nearestRef(arrAll.filter(r=>r.sex==='F'), cursor, 'F');
              let did=false;
              if (refM && refM.lb!==null && refM.ub!==null){ const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
                 VALUES ($1,'M',$2,$3,'años',$4,$5,'',$6,$7) ON CONFLICT DO NOTHING`, [pid, cursor, s, unit, method, refM.lb, refM.ub]); inserted+=r.rowCount||0; did=true; }
              if (refF && refF.lb!==null && refF.ub!==null){ const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
                 VALUES ($1,'F',$2,$3,'años',$4,$5,'',$6,$7) ON CONFLICT DO NOTHING`, [pid, cursor, s, unit, method, refF.lb, refF.ub]); inserted+=r.rowCount||0; did=true; }
              if (!did){
                const refAny = nearestRef(arrAll, cursor, 'Ambos') || nearestRef(arrAll, cursor, null);
                if (refAny && refAny.lb!==null && refAny.ub!==null){ const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
                   VALUES ($1,'Ambos',$2,$3,'años',$4,$5,'',$6,$7) ON CONFLICT DO NOTHING`, [pid, cursor, s, unit, method, refAny.lb, refAny.ub]); inserted+=r.rowCount||0; }
                else { const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
                   VALUES ($1,'Ambos',$2,$3,'años',$4,$5,'(Texto libre)',NULL,NULL) ON CONFLICT DO NOTHING`, [pid, cursor, s, unit, method]); inserted+=r.rowCount||0; }
              }
            } else {
              const ref = nearestRef(arrAll, cursor, 'Ambos') || nearestRef(arrAll, cursor, null);
              if (ref && ref.lb!==null && ref.ub!==null){ const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
                 VALUES ($1,'Ambos',$2,$3,'años',$4,$5,'',$6,$7) ON CONFLICT DO NOTHING`, [pid, cursor, s, unit, method, ref.lb, ref.ub]); inserted+=r.rowCount||0; }
              else { const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
                 VALUES ($1,'Ambos',$2,$3,'años',$4,$5,'(Texto libre)',NULL,NULL) ON CONFLICT DO NOTHING`, [pid, cursor, s, unit, method]); inserted+=r.rowCount||0; }
            }
          }
          cursor = Math.max(cursor, e); if (cursor>=reqE) break;
        }
        if (cursor < reqE){
          if (sexDiff){
            const refM = nearestRef(arrAll.filter(r=>r.sex==='M'), cursor, 'M');
            const refF = nearestRef(arrAll.filter(r=>r.sex==='F'), cursor, 'F');
            let did=false;
            if (refM && refM.lb!==null && refM.ub!==null){ const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
               VALUES ($1,'M',$2,$3,'años',$4,$5,'',$6,$7) ON CONFLICT DO NOTHING`, [pid, cursor, reqE, unit, method, refM.lb, refM.ub]); inserted+=r.rowCount||0; did=true; }
            if (refF && refF.lb!==null && refF.ub!==null){ const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
               VALUES ($1,'F',$2,$3,'años',$4,$5,'',$6,$7) ON CONFLICT DO NOTHING`, [pid, cursor, reqE, unit, method, refF.lb, refF.ub]); inserted+=r.rowCount||0; did=true; }
            if (!did){
              const refAny = nearestRef(arrAll, cursor, 'Ambos') || nearestRef(arrAll, cursor, null);
              if (refAny && refAny.lb!==null && refAny.ub!==null){ const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
                 VALUES ($1,'Ambos',$2,$3,'años',$4,$5,'',$6,$7) ON CONFLICT DO NOTHING`, [pid, cursor, reqE, unit, method, refAny.lb, refAny.ub]); inserted+=r.rowCount||0; }
              else { const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
                 VALUES ($1,'Ambos',$2,$3,'años',$4,$5,'(Texto libre)',NULL,NULL) ON CONFLICT DO NOTHING`, [pid, cursor, reqE, unit, method]); inserted+=r.rowCount||0; }
            }
          } else {
            const ref = nearestRef(arrAll, cursor, 'Ambos') || nearestRef(arrAll, cursor, null);
            if (ref && ref.lb!==null && ref.ub!==null){ const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
               VALUES ($1,'Ambos',$2,$3,'años',$4,$5,'',$6,$7) ON CONFLICT DO NOTHING`, [pid, cursor, reqE, unit, method, ref.lb, ref.ub]); inserted+=r.rowCount||0; }
            else { const r=await pool.query(`INSERT INTO analysis_reference_ranges (parameter_id, sex, age_min, age_max, age_min_unit, unit, method, text_value, lower, upper)
               VALUES ($1,'Ambos',$2,$3,'años',$4,$5,'(Texto libre)',NULL,NULL) ON CONFLICT DO NOTHING`, [pid, cursor, reqE, unit, method]); inserted+=r.rowCount||0; }
          }
        }
      }
      if (inserted) changes.insertPlaceholders = inserted;

      await pool.query('COMMIT');
    }

    // Legacy: marcar texto en filas sin límites
    const legacy = await hasTable(pool, 'reference_ranges');
    if (legacy){
      try {
        const res = await pool.query(`UPDATE reference_ranges SET text_value='(Texto libre)'
          WHERE COALESCE(lower, min_value) IS NULL AND COALESCE(upper, max_value) IS NULL AND COALESCE(text_value,'')=''`);
        changes.legacyMarkText += res.rowCount || 0;
  } catch(err){ if (process.env.DEBUG) console.warn('legacy mark text skipped', err && err.message); }
    }

    console.log(JSON.stringify({ ok: true, changes }, null, 2));
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  }
}

async function main(){
  const dbName = process.env.PGDATABASE || process.env.DB || process.argv.find(a=>a.startsWith('--db='))?.split('=')[1];
  if (!dbName){ console.error('Falta PGDATABASE o --db=<name>'); process.exit(1); }
  await run(dbName);
}

if (require.main === module) main();

module.exports = { run };
