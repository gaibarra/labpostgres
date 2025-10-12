#!/usr/bin/env node
/**
 * auditRangeOverlaps.js
 * Revisa estudios con más de un parámetro y detecta:
 *  - Duplicados exactos de rangos (mismo sexo, edad_min/max, método, unidad)
 *  - Traslapes dentro del mismo sexo (intervalos solapados)
 *  - Traslapes entre "Ambos" y sexos específicos (Masculino/Femenino)
 *  - Parámetros duplicados por nombre dentro de un mismo estudio
 *
 * Uso:
 *   node scripts/auditRangeOverlaps.js --db=lab_mitenant [--like="%Hemoglobina%|Hormonas"] [--format=table|json]
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) {
  try { require('dotenv').config(); } catch (_) { /* ignore */ }
}
const { Pool } = require('pg');

function parseArgs(){
  const out={ format:'table' };
  for (const a of process.argv.slice(2)){
    const m=a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
  }
  return out;
}

function normSex(v){
  const s=(v||'').toString().trim().toLowerCase();
  if (!s) return 'Ambos';
  if (['m','masculino','male','hombre'].includes(s)) return 'Masculino';
  if (['f','femenino','female','mujer'].includes(s)) return 'Femenino';
  if (['a','ambos','all','any','todos'].includes(s)) return 'Ambos';
  return 'Ambos';
}

function clampAge(x){
  if (x==null) return null;
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.min(120, Math.max(0, n));
}

function buildFilter(val){
  if (!val) return { sql: '', params: [] };
  const pieces = String(val).split(/[|,]/).map(s=>s.trim()).filter(Boolean);
  if (!pieces.length) return { sql: '', params: [] };
  const conds=[]; const params=[];
  for (const t of pieces){
    const p = /[%_]/.test(t) ? t : `%${t}%`;
    params.push(p);
    const idx = params.length;
    conds.push(`(a.name ILIKE $${idx} OR a.category ILIKE $${idx} OR ap.name ILIKE $${idx})`);
  }
  return { sql: `WHERE ${conds.join(' OR ')}`, params };
}

function intervalsOverlap(aStart,aEnd,bStart,bEnd){
  return aStart < bEnd && bStart < aEnd; // abierto por derecha
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
  if (!dbName){ console.error('Falta --db o variable PGDATABASE/TENANT_DB'); process.exit(1); }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName,
  });
  try {
    const where = buildFilter(args.like);
    // Traer análisis, parámetros y rangos (sólo modernos)
    const q = `
      WITH params AS (
        SELECT a.id AS analysis_id, a.name AS analysis_name, a.category,
               ap.id AS parameter_id, ap.name AS parameter_name, ap.unit, ap.position
        FROM analysis a
        JOIN analysis_parameters ap ON ap.analysis_id=a.id
        ${where.sql}
      ), counts AS (
        SELECT analysis_id, COUNT(*) AS param_count FROM params GROUP BY analysis_id
      )
      SELECT p.analysis_id, p.analysis_name, p.category, c.param_count,
             p.parameter_id, p.parameter_name, p.unit,
             arr.id AS range_id, arr.sex, arr.age_min, arr.age_max, arr.age_min_unit, arr.method,
             arr.lower, arr.upper, arr.text_value
      FROM params p
      JOIN counts c ON c.analysis_id = p.analysis_id
      LEFT JOIN analysis_reference_ranges arr ON arr.parameter_id = p.parameter_id
      WHERE c.param_count > 1
      ORDER BY p.analysis_name, p.parameter_name, arr.age_min NULLS FIRST, arr.age_max NULLS FIRST, arr.sex`;
    const { rows } = await pool.query(q, where.params);

    // Detectar nombres de parámetros duplicados por análisis
    const dupParamNameIssues = [];
    {
      const map = new Map(); // key: analysis_id -> Map(nameLower -> Set(paramId))
      for (const r of rows){
        const k = r.analysis_id;
        if (!map.has(k)) map.set(k, new Map());
        const inner = map.get(k);
        const n = (r.parameter_name||'').trim().toLowerCase();
        if (!inner.has(n)) inner.set(n, new Set());
        inner.get(n).add(r.parameter_id);
      }
      for (const [aid, inner] of map.entries()){
        for (const [nameLower, idSet] of inner.entries()){
          if (idSet.size > 1){
            dupParamNameIssues.push({
              analysis_id: aid,
              parameter_name: nameLower,
              issue: 'DUP_PARAM_NAME',
              details: `IDs: ${Array.from(idSet).join(', ')}`
            });
          }
        }
      }
    }

    // Agrupar por parámetro para revisar rangos
    const byParam = new Map();
    for (const r of rows){
      const key = r.parameter_id;
      if (!byParam.has(key)) byParam.set(key, {
        analysis_id: r.analysis_id,
        analysis_name: r.analysis_name,
        category: r.category,
        parameter_id: r.parameter_id,
        parameter_name: r.parameter_name,
        unit: r.unit,
        ranges: []
      });
      if (r.range_id==null) continue;
      const start = clampAge(r.age_min==null?0:r.age_min);
      const end = clampAge(r.age_max==null?120:r.age_max);
      if (start==null || end==null) continue;
      byParam.get(key).ranges.push({
        id: r.range_id,
        sex: normSex(r.sex),
        start,
        end,
        method: (r.method||'').trim() || null,
        unit: r.unit || null
      });
    }

    const issues = [];
    for (const v of byParam.values()){
      // Duplicados exactos por sexo
      const seen = new Map(); // key: sex|start|end|method|unit -> range_id[]
      for (const rr of v.ranges){
        const k = [rr.sex, rr.start, rr.end, rr.method||'', rr.unit||''].join('|');
        if (!seen.has(k)) seen.set(k, []);
        seen.get(k).push(rr.id);
      }
      for (const [k, list] of seen.entries()){
        if (list.length>1){
          const [sex, start, end] = k.split('|');
          issues.push({
            analysis: v.analysis_name,
            parameter: v.parameter_name,
            unit: v.unit || '',
            sex,
            issue: 'HIGH_DUPLICATE_RANGE',
            interval1: `${start}–${end}`,
            interval2: `${start}–${end}`,
            details: `Ranges IDs: ${list.join(', ')}`
          });
        }
      }
      // Traslapes dentro del mismo sexo
      const perSex = { Masculino: [], Femenino: [], Ambos: [] };
      for (const rr of v.ranges){ perSex[rr.sex]?.push(rr); }
      for (const sex of ['Masculino','Femenino','Ambos']){
        const list = (perSex[sex]||[]).slice().sort((a,b)=> a.start-b.start || a.end-b.end);
        for (let i=1;i<list.length;i++){
          const prev = list[i-1]; const curr = list[i];
          if (intervalsOverlap(prev.start, prev.end, curr.start, curr.end)){
            issues.push({
              analysis: v.analysis_name,
              parameter: v.parameter_name,
              unit: v.unit || '',
              sex,
              issue: 'HIGH_OVERLAP_SAME_SEX',
              interval1: `${prev.start}–${prev.end}`,
              interval2: `${curr.start}–${curr.end}`,
              details: `IDs: ${prev.id}, ${curr.id}`
            });
          }
        }
      }
      // Traslapes entre Ambos vs M/F
      const listA = (perSex.Ambos||[]);
      const listM = (perSex.Masculino||[]);
      const listF = (perSex.Femenino||[]);
      for (const a of listA){
        for (const m of listM){
          if (intervalsOverlap(a.start,a.end,m.start,m.end)){
            issues.push({
              analysis: v.analysis_name,
              parameter: v.parameter_name,
              unit: v.unit || '',
              sex: 'Ambos ⟷ Masculino',
              issue: 'WARN_AMBOS_OVERLAP_SEX',
              interval1: `${a.start}–${a.end}`,
              interval2: `${m.start}–${m.end}`,
              details: `IDs: ${a.id}, ${m.id}`
            });
          }
        }
        for (const f of listF){
          if (intervalsOverlap(a.start,a.end,f.start,f.end)){
            issues.push({
              analysis: v.analysis_name,
              parameter: v.parameter_name,
              unit: v.unit || '',
              sex: 'Ambos ⟷ Femenino',
              issue: 'WARN_AMBOS_OVERLAP_SEX',
              interval1: `${a.start}–${a.end}`,
              interval2: `${f.start}–${f.end}`,
              details: `IDs: ${a.id}, ${f.id}`
            });
          }
        }
      }
    }

    // Añadir issues por nombre de parámetro duplicado en estudio
    for (const d of dupParamNameIssues){
      const analysisName = rows.find(r=>r.analysis_id===d.analysis_id)?.analysis_name || `analysis#${d.analysis_id}`;
      issues.push({
        analysis: analysisName,
        parameter: d.parameter_name,
        unit: '',
        sex: '—',
        issue: 'HIGH_DUPLICATE_PARAMETER_NAME',
        interval1: '—',
        interval2: '—',
        details: d.details
      });
    }

    if (args.format === 'json'){
      console.log(JSON.stringify(issues, null, 2));
    } else {
      const headers = ['Análisis','Parámetro','Unidad','Sexo/Comparación','Problema','Intervalo A','Intervalo B','Detalles'];
      console.log(headers.join('\t'));
      for (const it of issues){
        console.log([
          it.analysis,
          it.parameter,
          it.unit||'',
          it.sex||'',
          it.issue,
          it.interval1,
          it.interval2,
          it.details||''
        ].join('\t'));
      }
      const high = issues.filter(i=>/^HIGH_/.test(i.issue)).length;
      const warn = issues.filter(i=>/^WARN_/.test(i.issue)).length;
      console.error(`\n[OverlapAudit] Problemas: HIGH=${high}, WARN=${warn}, TOTAL=${issues.length}`);
    }
  } catch (e){
    console.error('[AUDIT_OVERLAP] Error:', e.message);
    process.exit(1);
  } finally { await pool.end(); }
}

if (require.main === module){ main(); }

module.exports = {};
