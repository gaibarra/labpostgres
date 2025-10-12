#!/usr/bin/env node
/**
 * auditReferenceRanges.js
 * Verifica que los rangos de referencia cubran 0–120 años y reporta gaps por parámetro.
 * También indica presencia de splits por sexo (Masculino/Femenino/Ambos).
 *
 * Uso:
 *   node scripts/auditReferenceRanges.js --db=lab_gonzalo [--like="%Cortisol%"] [--format=table|json]
 */
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) {
  try { require('dotenv').config(); } catch (_) { /* ignore */ }
}
const { Pool } = require('pg');
const { isQualitativeByDesign } = require('../utils/qualitativeAllowlist');

function parseArgs(){
  const out={ format:'table', list:null };
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

function mergeIntervals(intervals){
  if (!intervals.length) return [];
  const srt = intervals.slice().sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
  const out=[];
  let [cs, ce] = srt[0];
  for (let i=1;i<srt.length;i++){
    const [s,e] = srt[i];
    if (s <= ce){
      ce = Math.max(ce, e);
    } else {
      out.push([cs, ce]);
      [cs, ce] = [s, e];
    }
  }
  out.push([cs, ce]);
  return out;
}

function invertCoverage(merged, domain=[0,120]){
  const gaps=[];
  let cursor = domain[0];
  for (const [s,e] of merged){
    if (s>cursor){ gaps.push([cursor, Math.min(s, domain[1])]); }
    cursor = Math.max(cursor, e);
    if (cursor>=domain[1]) break;
  }
  if (cursor < domain[1]) gaps.push([cursor, domain[1]]);
  return gaps.filter(([a,b])=> b>a);
}

function formatRange([a,b]){ return `${a}–${b}`; }

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.TENANT_DB || process.env.PGDATABASE;
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
    const likeRaw = args.like ? String(args.like) : null;
    const buildFilter = (val) => {
      if (!val) return { sql: '', params: [] };
      const pieces = val.split(/[|,]/).map(s=>s.trim()).filter(Boolean);
      if (!pieces.length) return { sql: '', params: [] };
      const conds = [];
      const params = [];
      for (const t of pieces){
        const hasWildcard = /[%_]/.test(t);
        const p = hasWildcard ? t : `%${t}%`;
        params.push(p);
        const idx = params.length;
        conds.push(`(a.name ILIKE $${idx} OR ap.name ILIKE $${idx} OR a.category ILIKE $${idx})`);
      }
      return { sql: `WHERE ${conds.join(' OR ')}`, params };
    };
    const where = buildFilter(likeRaw);
    const q = `
  SELECT a.id as analysis_id, a.name as analysis_name, a.category,
     ap.id as parameter_id, ap.name as parameter_name, COALESCE(ap.unit, a.general_units) as unit,
     arr.id as range_id, arr.sex, arr.age_min, arr.age_max, arr.age_min_unit, arr.method,
     arr.lower, arr.upper, arr.text_value
      FROM analysis a
      JOIN analysis_parameters ap ON ap.analysis_id = a.id
      LEFT JOIN analysis_reference_ranges arr ON arr.parameter_id = ap.id
      ${where.sql}
      ORDER BY a.name, ap.position NULLS LAST, ap.name
    `;
    const { rows } = await pool.query(q, where.params);
    // group by parameter
    const byParam = new Map();
    for (const r of rows){
      const key = r.parameter_id || `${r.analysis_id}|${r.parameter_name}`;
      if (!byParam.has(key)) byParam.set(key, {
        analysis: r.analysis_name,
        category: r.category,
        parameter: r.parameter_name,
        unit: r.unit,
        methodSeen: new Set(),
        ranges: [],
        rawRows: []
      });
      // Solo considerar filas reales de rangos (cuando existe arr.id)
      if (r.range_id == null) continue;
      const ageMin = clampAge(r.age_min==null ? 0 : r.age_min);
      const ageMax = clampAge(r.age_max==null ? 120 : r.age_max);
      const sex = normSex(r.sex);
      if (ageMin==null || ageMax==null) continue;
      const m = (r.method||'').trim();
      if (m) byParam.get(key).methodSeen.add(m);
      byParam.get(key).ranges.push({ sex, start: ageMin, end: ageMax });
      byParam.get(key).rawRows.push({ range_id: r.range_id, lower: r.lower, upper: r.upper, text_value: r.text_value });
    }

    const report = [];
    for (const v of byParam.values()){
      const perSex = { Masculino: [], Femenino: [], Ambos: [] };
      // Si el parámetro no tiene ningún rango real, reportar como MISSING_RANGES
      if (!v.ranges.length) {
        report.push({
          analysis: v.analysis,
          category: v.category,
          parameter: v.parameter,
          unit: v.unit,
          methods: Array.from(v.methodSeen || []).join(', '),
          coverage_all: '—',
          coverage_m: '—',
          coverage_f: '—',
          coverage_ambos: '—',
          gaps_all: '0–120',
          severity: 'HIGH_MISSING_RANGES',
          note: 'El parámetro no tiene rangos en analysis_reference_ranges'
        });
        continue;
      }
      for (const r of v.ranges){ perSex[r.sex].push([r.start, r.end]); }
      const merged = {
        Masculino: mergeIntervals(perSex.Masculino),
        Femenino: mergeIntervals(perSex.Femenino),
        Ambos: mergeIntervals(perSex.Ambos),
      };
      // cobertura total: usar Ambos + M + F
      const allMerged = mergeIntervals([ ...merged.Ambos, ...merged.Masculino, ...merged.Femenino ]);
      const gapsAll = invertCoverage(allMerged);
      const gapsM = invertCoverage(merged.Masculino);
      const gapsF = invertCoverage(merged.Femenino);
      const gapsA = invertCoverage(merged.Ambos);
      const hasSplits = merged.Masculino.length>0 || merged.Femenino.length>0;
      const entry = {
        analysis: v.analysis,
        category: v.category,
        parameter: v.parameter,
        unit: v.unit,
        methods: Array.from(v.methodSeen || [] ).join(', '),
        coverage_all: allMerged.map(formatRange).join(', ') || '—',
        coverage_m: merged.Masculino.map(formatRange).join(', ') || '—',
        coverage_f: merged.Femenino.map(formatRange).join(', ') || '—',
        coverage_ambos: merged.Ambos.map(formatRange).join(', ') || '—',
        gaps_all: gapsAll.map(formatRange).join(', ') || 'OK',
        gaps_m: gapsM.map(formatRange).join(', ') || (merged.Masculino.length ? 'OK' : '—'),
        gaps_f: gapsF.map(formatRange).join(', ') || (merged.Femenino.length ? 'OK' : '—'),
        gaps_ambos: gapsA.map(formatRange).join(', ') || (merged.Ambos.length ? 'OK' : '—'),
        has_sex_split: hasSplits,
      };
      // Detectar si todos los rangos son cualitativos (sin límites numéricos)
      const onlyQualitative = Array.isArray(v.rawRows) && v.rawRows.filter(r=>r.range_id!=null).length>0
        ? v.rawRows.filter(r=>r.range_id!=null).every(r => (r.lower==null && r.upper==null))
        : false;
      if (onlyQualitative){
        const infoSeverity = isQualitativeByDesign(v.parameter) || isQualitativeByDesign(v.analysis + ' ' + v.parameter)
          ? 'INFO_QUALITATIVE_BY_DESIGN'
          : 'MEDIUM_ONLY_QUALITATIVE';
        report.push({
          analysis: v.analysis,
          category: v.category,
          parameter: v.parameter,
          unit: v.unit,
          methods: Array.from(v.methodSeen || []).join(', '),
          coverage_all: allMerged.map(formatRange).join(', ') || '—',
          coverage_m: merged.Masculino.map(formatRange).join(', ') || '—',
          coverage_f: merged.Femenino.map(formatRange).join(', ') || '—',
          coverage_ambos: merged.Ambos.map(formatRange).join(', ') || '—',
          gaps_all: gapsAll.map(formatRange).join(', ') || 'OK',
          severity: infoSeverity,
          note: infoSeverity==='INFO_QUALITATIVE_BY_DESIGN' ? 'Parámetro cualitativo por diseño.' : 'Sólo rangos cualitativos (sin límites numéricos).'
        });
      }
      // Sólo reporta problemas por etapas: primero los que no cubren 0–120 en total
      if (gapsAll.length){
        entry.severity = 'HIGH_MISSING_ALL';
        report.push(entry);
      }
    }

    // Segunda pasada de la etapa: sugerir splits de sexo donde sólo hay Ambos para toda la vida
    for (const v of byParam.values()){
      const perSex = { Masculino: [], Femenino: [], Ambos: [] };
      if (!v.ranges.length) continue; // sin rangos, no sugerir split
      for (const r of v.ranges){ perSex[r.sex].push([r.start, r.end]); }
      const mergedA = mergeIntervals(perSex.Ambos);
      const mergedM = mergeIntervals(perSex.Masculino);
      const mergedF = mergeIntervals(perSex.Femenino);
      const allMerged = mergeIntervals([ ...mergedA, ...mergedM, ...mergedF ]);
      const noSexSplit = mergedM.length===0 && mergedF.length===0 && mergedA.length>0;
      const fullAll = invertCoverage(allMerged).length===0;
      if (noSexSplit && fullAll){
        // Heurística: marcar sólo si el análisis sugiere hormonas/sexo
        const name = (v.analysis + ' ' + v.parameter).toLowerCase();
        const maybeSexSpecific = /(fsh|lh|estradiol|testoster|progester|prolact|shbg|amh|inhibin|dhea|androst|17[- ]?oh|igf|gh|psa)/.test(name);
        if (maybeSexSpecific){
          report.push({
            analysis: v.analysis,
            category: v.category,
            parameter: v.parameter,
            unit: v.unit,
            coverage_all: allMerged.map(formatRange).join(', '),
            coverage_ambos: mergedA.map(formatRange).join(', '),
            severity: 'MEDIUM_SEX_SPLIT_SUGGESTED',
            note: 'Sólo "Ambos"; probable necesidad de separar por sexo en adultos.'
          });
        }
      }
    }

    if (args.list && args.list.toLowerCase() === 'methods'){
      // Listado simple de métodos por parámetro aunque no haya issues
      const headers = ['Análisis','Parámetro','Unidad','Métodos'];
      console.log(headers.join('\t'));
      for (const v of byParam.values()){
        const methods = Array.from(v.methodSeen||[]).join(', ');
        console.log([v.analysis, v.parameter, v.unit||'', methods].join('\t'));
      }
      return;
    }

    if (args.format === 'json'){
      console.log(JSON.stringify(report, null, 2));
    } else {
      // table
      const headers = ['Análisis','Parámetro','Unidad','Métodos','Gaps (All)','Cobertura All','Sexo M','Sexo F','Ambos','Severidad'];
      console.log(headers.join('\t'));
      for (const r of report){
        console.log([
          r.analysis,
          r.parameter,
          r.unit||'',
          r.methods||'',
          r.gaps_all||'',
          r.coverage_all||'',
          r.coverage_m||'',
          r.coverage_f||'',
          r.coverage_ambos||'',
          r.severity||''
        ].join('\t'));
      }
      // Count actionable items (exclude INFO_QUALITATIVE_BY_DESIGN)
      const actionable = report.filter(r => r.severity !== 'INFO_QUALITATIVE_BY_DESIGN').length;
      console.error(`\n[Audit] ${actionable} parámetro(s) con acciones sugeridas.`);
    }
  } catch (e){
    console.error('[AUDIT] Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module){
  main();
}

module.exports = {};
