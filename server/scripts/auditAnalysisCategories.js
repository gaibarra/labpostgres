#!/usr/bin/env node
/**
 * auditAnalysisCategories.js
 * Revisa todos los estudios (analysis) y propone una categoría profesional
 * usando reglas por nombre del estudio y, de ser necesario, hints del catálogo
 * de parámetros (clinicalParameters.js).
 *
 * Salida: JSON con lista de { id, name, currentCategory, proposedCategory, basis, paramCount }
 */
const { pool } = require('../db');
const { findParameter } = require('../catalog');

async function hasColumn(table, col){
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, col]
  );
  return rows.length > 0;
}

// no-op

// Taxonomía base y patrones
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
  const evidence = [];
  for (const pname of paramNames) {
    const hit = findParameter(pname);
    if (hit && Array.isArray(hit.categoryHints)) {
      for (const c of hit.categoryHints){
        counts.set(c, (counts.get(c)||0) + 1);
        evidence.push({ param: pname, hint: c });
      }
    }
  }
  if (!counts.size) return null;
  const top = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1])[0][0];
  return { category: top, basis: 'parameter-hints', evidence };
}

async function main(){
  const hasCat = await hasColumn('analysis', 'category');
  const aCols = ['id','name'];
  if (hasCat) aCols.push('category');
  // Traer lista de estudios y sus parámetros
  const { rows: analyses } = await pool.query(`SELECT ${aCols.join(', ')} FROM analysis ORDER BY name`);
  const { rows: params } = await pool.query(`SELECT analysis_id, name FROM analysis_parameters`);
  const pByA = params.reduce((acc, r)=>{ (acc[r.analysis_id] = acc[r.analysis_id] || []).push(r.name); return acc; }, {});

  const out = [];
  for (const a of analyses) {
    const byName = guessCategoryByName(a.name);
    const byParams = guessCategoryByParameters(pByA[a.id] || []);
    let proposed = 'Otros';
    let basis = 'fallback';
    if (byName) { proposed = byName.category; basis = byName.basis; }
    else if (byParams) { proposed = byParams.category; basis = byParams.basis; }
    out.push({ id: a.id, name: a.name, currentCategory: hasCat ? (a.category || null) : null, proposedCategory: proposed, basis, paramCount: (pByA[a.id]||[]).length });
  }
  console.log(JSON.stringify({ total: out.length, items: out }, null, 2));
  await pool.end();
}

main().catch(async (e)=>{ console.error('[AUDIT-CATEGORIES] ERROR', e); try { await pool.end(); } catch(_){/*ignore*/} process.exit(1); });
