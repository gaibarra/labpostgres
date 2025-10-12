#!/usr/bin/env node
/**
 * backfillUnits.js
 * Asigna unidades a analysis_parameters con valores numéricos de referencia y unit vacío.
 * Usa un mapeo curado por nombre de parámetro (case-insensitive) y, si no hay match exacto,
 * intenta inferir por el patrón de rangos existentes (por ejemplo, glucosa/triglicéridos/colesterol → mg/dL).
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(err) { /* opcional */ }

function clean(val){ if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1); return val; }

// Mapa curado (agrega aquí conforme veas casos)
const CURATED = new Map([
  // Inmunoglobulinas y perfiles metabólicos
  [/^igg4(\s|_|-)?total$/i, 'mg/dL'],
  [/^igg(\s|_|-)?total$/i, 'mg/dL'],
  [/^iga(\s|_|-)?s(é|e)rica$/i, 'mg/dL'],
  [/^igg(\s|_|-)?s(é|e)rica$/i, 'mg/dL'],
  [/^igm(\s|_|-)?s(é|e)rica$/i, 'mg/dL'],
  [/^glucosa/i, 'mg/dL'],
  [/^triglicer(i|í)dos/i, 'mg/dL'],
  [/^colesterol/i, 'mg/dL'],
  [/^hdl/i, 'mg/dL'],
  [/^ldl/i, 'mg/dL'],
  [/^vldl/i, 'mg/dL'],
  [/^creatinina/i, 'mg/dL'],
  [/^urea/i, 'mg/dL'],
  [/^ac(í|i)do ur(í|i)co/i, 'mg/dL'],
  [/^calcio/i, 'mg/dL'],
  [/^magnesio/i, 'mg/dL'],
  [/^sodio/i, 'mmol/L'],
  [/^potasio/i, 'mmol/L'],
  [/^cloro/i, 'mmol/L'],

  // Hormonas y tiroideas
  [/^tsh/i, 'µIU/mL'],
  [/^t3\s*libre/i, 'pg/mL'],
  [/^t4\s*libre/i, 'ng/dL'],
  [/^estradiol/i, 'pg/mL'],
  [/^eritropoyetina|eritropoyetina/i, 'mIU/mL'],

  // Proteína C reactiva
  [/^prote(í|i)na c.?reactiva/i, 'mg/L'],
  [/^pcr(\b|\s|\()/i, 'mg/L'],
  [/^pcr\s+ultrasensible/i, 'mg/L'],

  // Marcadores tumorales (comunes)
  [/^afp(\b|\s|\()/i, 'ng/mL'],
  [/^cea(\b|\s|\()/i, 'ng/mL'],
  [/^cyfra\s*21-1/i, 'ng/mL'],
  [/^ca\s*125/i, 'U/mL'],
  [/^ca\s*15-3/i, 'U/mL'],
  [/^ca\s*19-9/i, 'U/mL'],
  [/^ca\s*72-4/i, 'U/mL'],

  // Anticuerpos / autoinmunidad
  [/^aso(\b|\s|\()/i, 'IU/mL'],
  [/^aso\s*\(antiestreptolisina/i, 'IU/mL'],
  [/^anticuerpos\s+anti-?tpo/i, 'IU/mL'],
  [/^anticuerpos\s+anti-?tiroglobulina/i, 'IU/mL'],
  [/^ige\s*total/i, 'kU/L'],

  // Complemento
  [/^complemento\s*c3/i, 'mg/dL'],
  [/^complemento\s*c4/i, 'mg/dL'],
  [/^ch50/i, 'U/mL'],
  [/^c1\s*inhibidor\s*\(funci(ó|o)n\)/i, '%'],
  [/^c1\s*inhibidor\s*\(cantidad\)/i, 'mg/dL'],
  [/^plasmin(ó|o)geno/i, '%'],

  // Drogas y TDM
  [/^amiodarona/i, 'µg/mL'],
  [/^digoxina/i, 'ng/mL'],
  [/^ciclosporina/i, 'ng/mL'],
  [/^everolimus/i, 'ng/mL'],
  [/^carbamazepina/i, 'µg/mL'],
  [/^amikacina/i, 'µg/mL'],
  [/^gentamicina/i, 'µg/mL'],
  [/^levetiracetam/i, 'µg/mL'],
  [/^tobramicina/i, 'µg/mL'],
  [/^litio(\s|$)/i, 'mmol/L'],
  [/^litio\s*\(nivel\s*terap(é|e)utico\)/i, 'mmol/L'],
  [/^procainamida\s*\/?\s*napa/i, 'µg/mL'],
  [/^sirolimus/i, 'ng/mL'],
  [/^tacrolimus/i, 'ng/mL'],
  [/^teofilina/i, 'µg/mL'],
  [/^salicilatos/i, 'mg/dL'],
  [/^valproato|\b(ácido|acido)\s+valproico/i, 'µg/mL'],
  [/^vancomicina(\s*\(pico\/(valle|trough)\))?/i, 'µg/mL'],
  [/^vasopresina|\badh\b/i, 'pg/mL'],
  [/^metanol/i, 'mg/dL'],

  // Gases / COHb / Etanol
  [/^carboxihemoglobina(\s|$)/i, '%'],
  [/^cohb(\s|$)/i, '%'],
  [/^carboxihemoglobina\s+venosa/i, '%'],
  [/^cohb\s+venoso/i, '%'],
  [/^exceso\s+de\s+base/i, 'mmol/L'],
  [/^etanol/i, 'mg/dL'],
  [/^vol(á|a)tiles\s*\(etanol\)/i, 'mg/dL'],
  [/^lactato/i, 'mmol/L'],
  [/^hco(3|₃)/i, 'mmol/L'],
  [/^pco(2|₂)/i, 'mmHg'],
  [/^po(2|₂)/i, 'mmHg'],
  [/^saturaci(ó|o)n\s+de\s+o(2|₂)/i, '%'],
  [/^ph\s+arterial/i, ''],
  [/^ph\s+fecal/i, ''],

  // Fecales
  [/^calprotectina\s+fecal/i, 'µg/g'],
  [/^elastasa\s+pancre(á|a)tica\s+fecal/i, 'µg/g'],
  [/^lactoferrina\s+fecal/i, 'µg/g'],
  [/^grasas\s+en\s+heces.*cuantitativa/i, 'g/24h'],

  // Varios
  [/^beta-?hcg/i, 'mIU/mL'],
  [/^hcg\s*total/i, 'mIU/mL'],
  [/^metahemoglobina/i, '%'],
  [/^methemoglobina/i, '%'],
  [/^beta-?2\s+microglobulina/i, 'mg/L'],
  [/^d(í|i)mero\s*d/i, 'ng/mL'],
  [/^fibrin(ó|o)geno/i, 'mg/dL'],
  [/^triptasa\s+s(é|e)rica/i, 'µg/L'],
  [/^tr\s*ab\s*\/\s*tsi/i, 'IU/L'],
  // Marcadores y hormonas adicionales
  [/^he4\b/i, 'pmol/L'],
  [/^hepcidina/i, 'ng/mL'],
  [/^leptina/i, 'ng/mL'],
  [/^adiponectina/i, 'µg/mL'],
  [/^nse\b/i, 'ng/mL'],
  [/^factor\s+reumatoide/i, 'IU/mL'],
  [/^oxitocina/i, 'pg/mL'],
  [/^procalcitonina/i, 'ng/mL'],
  [/^progrp/i, 'pg/mL'],
  [/^scc\b/i, 'ng/mL'],
  [/^preal(b|bú)mina/i, 'mg/dL'],
  [/^retinol-?binding\s+protein/i, 'mg/L'],
  [/^receptor\s+soluble\s+de\s+transferrina/i, 'mg/L'],
  [/^psa\s+total/i, 'ng/mL'],
  [/^psa\s+libre/i, 'ng/mL'],
  [/^tiroglobulina/i, 'ng/mL'],
  [/^von\s+willebrand\s+ant(í|i)geno/i, '%'],
  [/^vsg\b/i, 'mm/h'],
  [/^yodo\s+urinario/i, 'µg/L'],
  [/^zinc\s+seminal/i, 'mg/L'],
  [/^zinc\b/i, 'µg/dL'],
  [/^(a|á)cido\s+f(ó|o)lico/i, 'ng/mL'],
  [/^(a|á)cido\s+(u|ú)rico\s+urinario\s*24\s*h/i, 'mg/24h'],
  [/^(a|á)cidos\s+biliares\s+s(é|e)ricos/i, 'µmol/L'],
  [/^(i|í)ndice\s+al(b|v)(ú|u)mina\/creatinina\s+urinaria/i, 'mg/g'],
  [/^(i|í)ndice\s+de\s+saturaci(ó|o)n\s+de\s+transferrina/i, '%'],
  
  // Complemento adicional
  [/^complemento\s*c1q/i, 'mg/dL'],
  
  // TDM adicional
  [/^clozapina/i, 'ng/mL'],
  [/^fenito(í|i)na/i, 'µg/mL'],
  [/^fenobarbital/i, 'µg/mL'],
  [/^metotrexato/i, 'µmol/L'],
  [/^paracetamol|acetaminof(é|e)n/i, 'µg/mL'],

  // Metales (suero/sangre)
  [/^aluminio/i, 'µg/L'],
  [/^ars(é|e)nico/i, 'µg/L'],
  [/^cromo/i, 'µg/L'],
  [/^manganeso/i, 'µg/L'],
  [/^mercurio(\s*\(hg\))?/i, 'µg/L'],
  [/^cobre/i, 'µg/dL'],
  [/^plomo(\s*\(pb\))?/i, 'µg/dL'],
  [/^selenio/i, 'µg/L'],

  // Orina 24h y conteos
  [/^eritrocitos\s+urinarios.*conteo/i, 'cél/µL'],
  [/^leucocitos\s+urinarios.*conteo/i, 'cél/µL'],
  [/^fructosa\s+seminal/i, 'mg/dL'],
  [/^alpha-?glucosidasa\s+neutral\s+seminal/i, 'U/L'],
  [/^citrato\s+urinario\s*24\s*h/i, 'mg/24h'],
  [/^fosfato\s+urinario\s*24\s*h/i, 'mg/24h'],
  [/^oxalato\s+urinario\s*24\s*h/i, 'mg/24h'],
  [/^nitr(ó|o)geno\s+ureico\s+urinario\s*24\s*h/i, 'g/24h'],
  [/^microalb(ú|u)mina\s+urinaria/i, 'mg/L'],
  [/^proteinuria\s*24\s*h/i, 'g/24h'],
  [/^prote(í|i)na\s+urinaria\s+puntual/i, 'mg/dL'],
  [/^nicotina\s*\/\s*cotinina/i, 'ng/mL'],
  [/^opi(á|a)ceos.*confirmatorio/i, 'ng/mL'],
  [/^coca(í|i)na.*confirmatorio/i, 'ng/mL'],
]);

function fromCurated(name){
  for (const [re, u] of CURATED.entries()) if (re.test(name)) return u;
  return null;
}

function heuristic(name){
  const n = (name||'').toLowerCase();
  if (n.includes('%') || /porcentaje/.test(n)) return '%';
  if (/actividad/.test(n)) return '%';
  if (/\bratio\b/.test(n)) return '';
  if (/lupus\s+anticoagulante.*drvvt\s*ratio/i.test(n)) return '';
  if (/resistencia\s+a\s+prote(í|i)na\s+c\s+activada/i.test(n)) return '';
  if (/^tiempo\s+de\s+/i.test(n)) return 's';
  if (/\btt(pa|p)\b|a\s*ptt|aptt|tpa|tp\s*\(tiempo\s*de\s*protrombina\)/i.test(n)) return 's';
  if (/recuento\s+absoluto/.test(n) && /(eosin(ó|o)filos|bas(ó|o)filos|linfocitos|monocitos|neutr(ó|o)filos)/.test(n)) return 'cél/µL';
  if (/24\s*h/.test(n)) {
    if (/citrato|fosfato|oxalato/.test(n)) return 'mg/24h';
    if (/nitr(ó|o)geno\s+ureico/.test(n)) return 'g/24h';
  if (/(a|á)cido\s+(u|ú)rico/.test(n) && /urinario/.test(n)) return 'mg/24h';
  }
  return null;
}

async function main(){
  const pool = new Pool({ host: process.env.PGHOST, port: process.env.PGPORT||5432, user: process.env.PGUSER, password: clean(process.env.PGPASSWORD), database: process.env.PGDATABASE });
  let updated = 0;
  try {
    const { rows } = await pool.query(`
      SELECT ap.id, ap.name, ap.unit, a.name AS analysis_name, COALESCE(a.general_units,'') AS general_units
      FROM analysis_parameters ap
      JOIN analysis a ON a.id = ap.analysis_id
      WHERE ap.unit IS NULL OR TRIM(ap.unit) = ''
    `);
    for (const r of rows){
  const guess = fromCurated(r.name || '') || fromCurated(r.analysis_name || '') || heuristic(r.name || '') || heuristic(r.analysis_name || '') || ((r.general_units||'').trim() || null);
      if (!guess) continue;
      const res = await pool.query(`UPDATE analysis_parameters SET unit = $2 WHERE id = $1 AND (unit IS NULL OR TRIM(unit)='')`, [r.id, guess]);
      updated += res.rowCount || 0;
    }
    console.log(JSON.stringify({ ok:true, updated }, null, 2));
  } catch (e) {
    console.error('ERROR backfillUnits:', e.message);
    process.exit(1);
  } finally { await pool.end().catch(()=>{}); }
}

if (require.main === module) main();
