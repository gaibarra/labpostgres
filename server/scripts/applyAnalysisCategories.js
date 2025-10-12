#!/usr/bin/env node
/**
 * applyAnalysisCategories.js
 * Persiste categorías propuestas en la tabla analysis.
 * - Lee propuestas ejecutando el auditor internamente (mismo algoritmo)
 * - Soporta overrides manuales por id (archivo JSON opcional)
 * - dry-run por defecto; usar --apply para ejecutar
 * - Reporte por categoría con conteo y muestra de cambios
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { findParameter } = require('../catalog');
const { CATEGORIES, isValidCategory } = require('../utils/analysisCategories');

function normalizeCategory(cat){
  if (!cat) return 'Otros';
  // Mapeo de sinónimos/variantes a categorías del catálogo
  const map = new Map([
    ['endocrino','Endocrinología'],
    ['endocrinologia','Endocrinología'],
    ['hepatico','Función Hepática'],
    ['hepática','Función Hepática'],
    ['hepático','Función Hepática'],
    ['renal','Función Renal'],
    ['lipidos','Perfil Lipídico'],
    ['lípidos','Perfil Lipídico'],
    ['quimica sanguinea','Química Clínica'],
    ['química sanguínea','Química Clínica'],
    ['bioquimica','Química Clínica'],
    ['bioquímica','Química Clínica'],
    ['metabolismo','Química Clínica'],
    ['metabolismo hierro','Química Clínica'],
    ['cardíaco','Cardiaco'],
    ['cardiaco','Cardiaco'],
    ['virologia','Virología'],
    ['virología','Virología'],
    ['genetica','Genética/Molecular'],
    ['genética','Genética/Molecular'],
  ]);
  const raw = String(cat).trim();
  if (isValidCategory(raw)) return raw;
  const key = raw.normalize('NFD').replace(/\p{Diacritic}+/gu,'').toLowerCase();
  if (map.has(key)) return map.get(key);
  return isValidCategory(raw) ? raw : 'Otros';
}

function parseArgs(){
  const args = process.argv.slice(2);
  const opts = { apply: false, overrides: null, output: null };
  for (let i=0;i<args.length;i++){
    const a=args[i];
    if (a==='--apply') opts.apply=true;
    else if (a==='--overrides' && args[i+1]) { opts.overrides=args[++i]; }
    else if (a==='--out' && args[i+1]) { opts.output=args[++i]; }
  }
  return opts;
}

async function hasColumn(table, col){
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, col]
  );
  return rows.length > 0;
}

const TAXONOMY = [
  { key:'Hematología', patterns:[/hemograma|biometr[íi]a|bh|eritro|leuco|plaqueta|vcm|hcm|chcm|rdw/i] },
  { key:'Coagulación', patterns:[/coagulaci[oó]n|tp\b|inr\b|ptt\b|aptt\b|tt\b|fibrin[oó]geno/i] },
  { key:'Química Clínica', patterns:[/qu[ií]mica|perfil qu[ií]mico|metab[oó]lico|quimica sangu[ií]nea/i] },
  { key:'Electrolitos', patterns:[/electrolito|sodio|potasio|cloruro|cloruros|calcio|magnesio|f[oó]sforo|fosfato/i] },
  { key:'Función Hepática', patterns:[/hep[aá]tico|perfil hep[aá]tico|tgo|ast|tgp|alt|fosfatasa alcalina|gama ?gt|bilirrub/i] },
  { key:'Perfil Lipídico', patterns:[/perfil lip[ií]dico|colesterol|hdl|ldl|triglic[eé]ridos|vldl/i] },
  { key:'Función Renal', patterns:[/renal|funci[oó]n renal|urea|creatinina|depuraci[oó]n/i] },
  { key:'Endocrinología', patterns:[/tiroidea|tsh|t3|t4|prolactina|cortisol|insulina|hormona|estradiol|progesterona|testosterona/i] },
  { key:'Inmunología/Serología', patterns:[/inmunolog[ií]a|serolog[ií]a|anticuerpo|igg|igm|iga|anti|factor reumatoide|vih|sifilis|vdrl|rpr|hepatitis/i] },
  { key:'Microbiología', patterns:[/cultivo|antibiogram|coprocultivo|urocultivo|baciloscopia|gram|tinción/i] },
  { key:'Orina', patterns:[/orina|ego|urinalysis|proteinuria|microalbuminuria/i] },
  { key:'Heces', patterns:[/coprol[oó]gico|coproparasitosc[oó]pico|heces|sangre oculta/i] },
  { key:'Gases en Sangre', patterns:[/gases (en )?sangre|gasometr[ií]a|po2|pco2|hco3|saturaci[oó]n/i] },
  { key:'Cardiaco', patterns:[/troponina|ck-mb|d-d[ií]mero|bnp|nt-pro-bnp/i] },
  { key:'Toxicología', patterns:[/t[oó]xico|drogas|toxicolog[ií]a|medicamentos? en orina|panel de drogas/i] },
  { key:'Virología', patterns:[/pcr .*virus|viral|influenza|sars-cov|covid|vih/i] },
  { key:'Genética/Molecular', patterns:[/gen[eé]tica|molecular|secuenciaci[oó]n|cnv|microarreglo|fish|karyo/i] },
  { key:'Prenatal', patterns:[/prenatal|tamizaje|screening prenatal|marcadores prenatales/i] },
  { key:'Vitaminas', patterns:[/vitamina\s*[adekbce]?\b|25-?oh|vit d|vitamina d/i] },
  { key:'Otros', patterns:[] }
];

function guessCategoryByName(name){
  const n = name || '';
  for (const t of TAXONOMY) {
    if (t.patterns.some(rx => rx.test(n))) return { category: t.key, basis: 'name-pattern' };
  }
  return null;
}

function guessCategoryByParameters(paramNames){
  const counts = new Map();
  for (const pname of paramNames) {
    const hit = findParameter(pname);
    if (hit && Array.isArray(hit.categoryHints)) {
      for (const c of hit.categoryHints){
        counts.set(c, (counts.get(c)||0) + 1);
      }
    }
  }
  if (!counts.size) return null;
  const top = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1])[0][0];
  return { category: top, basis: 'parameter-hints' };
}

async function loadOverrides(file){
  if (!file) return {};
  const full = path.resolve(process.cwd(), file);
  const txt = fs.readFileSync(full,'utf8');
  const data = JSON.parse(txt);
  const out = {};
  for (const it of data) {
    if (!it || typeof it.id==='undefined') continue;
    const cat = it.category || it.proposedCategory;
    if (isValidCategory(cat)) out[it.id] = cat;
  }
  return out;
}

async function main(){
  const opts = parseArgs();
  const hasCat = await hasColumn('analysis', 'category');
  if (!hasCat) {
    console.error('La columna analysis.category no existe. Ejecuta migraciones (npm run migrate).');
    process.exit(1);
  }

  const { rows: analyses } = await pool.query(`SELECT id, name, category FROM analysis ORDER BY name`);
  const { rows: params } = await pool.query(`SELECT analysis_id, name FROM analysis_parameters`);
  const pByA = params.reduce((acc, r)=>{ (acc[r.analysis_id] = acc[r.analysis_id] || []).push(r.name); return acc; }, {});

  const overrides = await loadOverrides(opts.overrides);

  const changes = [];
  for (const a of analyses) {
  let proposed='Otros', basis='fallback';
    if (overrides[a.id]) { proposed=overrides[a.id]; basis='override'; }
    else {
      const byName = guessCategoryByName(a.name);
      const byParams = guessCategoryByParameters(pByA[a.id] || []);
      if (byName) { proposed = byName.category; basis = byName.basis; }
      else if (byParams) { proposed = byParams.category; basis = byParams.basis; }
    }
    // Normalizar a catálogo permitido
    const normalized = normalizeCategory(proposed);
    if (!isValidCategory(normalized)) {
      // fallback final
      proposed = 'Otros';
    } else {
      proposed = normalized;
    }
    if (a.category !== proposed) {
      changes.push({ id:a.id, name:a.name, from:a.category || null, to: proposed, basis });
    }
  }

  // Reporte
  const byCat = new Map();
  for (const ch of changes) byCat.set(ch.to, (byCat.get(ch.to)||0)+1);
  const summary = Array.from(byCat.entries()).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({category:k, count:v}));

  const report = { totalAnalyses: analyses.length, totalChanges: changes.length, summary, categories: CATEGORIES };
  if (opts.output) {
    const outPath = path.resolve(process.cwd(), opts.output);
    fs.writeFileSync(outPath, JSON.stringify({ report, changes }, null, 2));
  }

  console.log(JSON.stringify(report, null, 2));
  if (!opts.apply) {
    // Mostrar primeras 20 propuestas como muestra
    console.log('\nMuestra de cambios (20):');
    for (const it of changes.slice(0,20)) {
      console.log(`- [${it.id}] ${it.name} :: ${it.from||'∅'} => ${it.to} (${it.basis})`);
    }
    await pool.end();
    return;
  }

  // Apply
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const ch of changes) {
      await client.query('UPDATE analysis SET category=$1 WHERE id=$2', [ch.to, ch.id]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[APPLY-CATEGORIES] Error aplicando cambios:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`Aplicados ${changes.length} cambios de categoría.`);
}

main().catch(async (e)=>{ console.error('[APPLY-CATEGORIES] ERROR', e); try { await pool.end(); } catch(_){/*ignore*/} process.exit(1); });
