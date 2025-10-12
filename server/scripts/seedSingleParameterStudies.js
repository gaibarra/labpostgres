#!/usr/bin/env node
/**
 * seedSingleParameterStudies.js
 * Inserta/actualiza estudios sueltos (uno o pocos parámetros) con rangos por edad/sexo.
 * Fuente: JSON en scripts/data/single_parameter_studies.json (o template si no existe).
 */
const fs = require('fs');
const path = require('path');
// Cargar .env desde raíz del repo o local
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) {
  try { require('dotenv').config(); } catch (_) { /* ignore */ }
}
const { Pool } = require('pg');
const { buildParameterTemplate } = require('../utils/referenceTemplates');

function clean(val){
  if (typeof val === 'string' && /^'.*'$/.test(val)) return val.slice(1,-1);
  return val;
}

async function hasTable(pool, name){
  const { rows } = await pool.query("SELECT to_regclass($1) t", [`public.${name}`]);
  return !!rows[0].t;
}
async function hasColumn(pool, table, column){
  const { rows } = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1",[table, column]);
  return !!rows[0];
}

async function upsertStudy(pool, s){
  const modeModern = await hasTable(pool,'analysis');
  if (!modeModern) return; // soportamos solo el modelo moderno
  // Derivar code/clave si no vienen en JSON
  const deriveCode = (name) => {
    if (!name) return `AUTO_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const ascii = name.normalize('NFD').replace(/\p{Diacritic}+/gu,'');
    const core = ascii.replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    const trimmed = core.slice(0, 32);
    return trimmed ? trimmed.toUpperCase() : `AUTO_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  };
  const codeVal = s.code || deriveCode(s.name);
  // Insertar/actualizar analysis
  const cols=['name']; const vals=['$1']; const params=[s.name];
  if (await hasColumn(pool,'analysis','category')) { cols.push('category'); vals.push(`$${params.length+1}`); params.push(s.category||null); }
  if (await hasColumn(pool,'analysis','code')) { cols.push('code'); vals.push(`$${params.length+1}`); params.push(codeVal); }
  if (await hasColumn(pool,'analysis','clave')) { cols.push('clave'); vals.push(`$${params.length+1}`); params.push(codeVal); }
  if (await hasColumn(pool,'analysis','description')) { cols.push('description'); vals.push(`$${params.length+1}`); params.push(s.description||null); }
  if (await hasColumn(pool,'analysis','indications')) { cols.push('indications'); vals.push(`$${params.length+1}`); params.push(s.indications||null); }
  if (await hasColumn(pool,'analysis','sample_type')) { cols.push('sample_type'); vals.push(`$${params.length+1}`); params.push(s.sample_type||null); }
  if (await hasColumn(pool,'analysis','sample_container')) { cols.push('sample_container'); vals.push(`$${params.length+1}`); params.push(s.sample_container||null); }
  if (await hasColumn(pool,'analysis','processing_time_hours')) { cols.push('processing_time_hours'); vals.push(`$${params.length+1}`); params.push(s.processing_time_hours??null); }
  if (await hasColumn(pool,'analysis','general_units')) { cols.push('general_units'); vals.push(`$${params.length+1}`); params.push(s.unit||null); }

  // Lookup existing analysis; guard for deployments without 'code' column
  const hasCodeCol = await hasColumn(pool, 'analysis', 'code');
  let analysisId = null;
  if (hasCodeCol) {
    const { rows: exist } = await pool.query(
      'SELECT id FROM analysis WHERE LOWER(name)=LOWER($1) OR LOWER(code)=LOWER($2) LIMIT 1',
      [s.name, codeVal.toLowerCase()]
    );
    analysisId = exist[0]?.id;
  } else {
    const { rows: exist } = await pool.query(
      'SELECT id FROM analysis WHERE LOWER(name)=LOWER($1) LIMIT 1',
      [s.name]
    );
    analysisId = exist[0]?.id;
  }
  // Ensure analysis exists
  if (!analysisId) {
    const ins = await pool.query(`INSERT INTO analysis(${cols.join(',')}) VALUES(${vals.join(',')}) RETURNING id`, params);
    analysisId = ins.rows[0].id;
  }
  // parameters
  if (Array.isArray(s.parameters)) {
    for (let i=0; i<s.parameters.length; i++){
      const p = s.parameters[i];
      const { rows: pExist } = await pool.query('SELECT id FROM analysis_parameters WHERE analysis_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1',[analysisId, p.name]);
      let paramId = pExist[0]?.id;
      if (!paramId){
        const pCols=['analysis_id','name']; const pVals=['$1','$2']; const pParams=[analysisId,p.name];
        if (await hasColumn(pool,'analysis_parameters','unit')) { pCols.push('unit'); pVals.push(`$${pParams.length+1}`); pParams.push(p.unit||s.unit||null); }
        if (await hasColumn(pool,'analysis_parameters','position')) { pCols.push('position'); pVals.push(`$${pParams.length+1}`); pParams.push(i+1); }
        if (await hasColumn(pool,'analysis_parameters','decimal_places')) { pCols.push('decimal_places'); pVals.push(`$${pParams.length+1}`); pParams.push(p.decimal_places??s.decimal_places??null); }
        const insP = await pool.query(`INSERT INTO analysis_parameters(${pCols.join(',')}) VALUES(${pVals.join(',')}) RETURNING id`, pParams);
        paramId = insP.rows[0].id;
      }
      // reference ranges
      const ranges = p.reference_ranges || [];
      const { rows: cntRes } = await pool.query('SELECT COUNT(*)::int c FROM analysis_reference_ranges WHERE parameter_id=$1',[paramId]);
      const existingCount = cntRes[0].c;

      if (existingCount === 0) {
        if (ranges.length > 0) {
          // Insert JSON-provided ranges
          for (const r of ranges){
            const cols=['parameter_id']; const vals=['$1']; const rp=[paramId];
            cols.push('sex'); vals.push(`$${rp.length+1}`); rp.push(r.sex||'Ambos');
            cols.push('age_min'); vals.push(`$${rp.length+1}`); rp.push(r.age_min ?? null);
            cols.push('age_max'); vals.push(`$${rp.length+1}`); rp.push(r.age_max ?? null);
            cols.push('age_min_unit'); vals.push(`$${rp.length+1}`); rp.push(r.age_min_unit || 'años');
            if (r.lower!=null || r.upper!=null){ cols.push('lower','upper'); vals.push(`$${rp.length+1}`,`$${rp.length+2}`); rp.push(r.lower, r.upper); }
            if (r.text_value!=null){ cols.push('text_value'); vals.push(`$${rp.length+1}`); rp.push(r.text_value); }
            if (r.notes!=null){ cols.push('notes'); vals.push(`$${rp.length+1}`); rp.push(r.notes); }
            if (await hasColumn(pool,'analysis_reference_ranges','unit') && (r.unit!=null || s.unit!=null || p.unit!=null)) { cols.push('unit'); vals.push(`$${rp.length+1}`); rp.push(r.unit||p.unit||s.unit||null); }
            if (await hasColumn(pool,'analysis_reference_ranges','method') && r.method!=null) { cols.push('method'); vals.push(`$${rp.length+1}`); rp.push(r.method); }
            await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rp);
          }
        } else {
          // Try template fallback, else qualitative default
          const tpl = buildParameterTemplate(p.name);
          if (tpl && Array.isArray(tpl.valorReferencia) && tpl.valorReferencia.length){
            for (const rr of tpl.valorReferencia){
              const cols=['parameter_id']; const vals=['$1']; const rp=[paramId];
              cols.push('sex'); vals.push(`$${rp.length+1}`); rp.push(rr.sexo||'Ambos');
              cols.push('age_min'); vals.push(`$${rp.length+1}`); rp.push(rr.edadMin ?? null);
              cols.push('age_max'); vals.push(`$${rp.length+1}`); rp.push(rr.edadMax ?? null);
              cols.push('age_min_unit'); vals.push(`$${rp.length+1}`); rp.push(rr.unidadEdad || 'años');
              if (rr.valorMin!=null || rr.valorMax!=null){ cols.push('lower','upper'); vals.push(`$${rp.length+1}`,`$${rp.length+2}`); rp.push(rr.valorMin ?? null, rr.valorMax ?? null); }
              if (rr.textoLibre!=null){ cols.push('text_value'); vals.push(`$${rp.length+1}`); rp.push(rr.textoLibre); }
              if (rr.notas!=null){ cols.push('notes'); vals.push(`$${rp.length+1}`); rp.push(rr.notas); }
              if (await hasColumn(pool,'analysis_reference_ranges','unit')) { cols.push('unit'); vals.push(`$${rp.length+1}`); rp.push(tpl.unit || p.unit || s.unit || null); }
              await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rp);
            }
            console.log('[SINGLE][TPL] Rangos desde plantilla añadidos para %s.', p.name);
          } else {
            const colSex = await hasColumn(pool,'analysis_reference_ranges','sex');
            const colAgeMin = await hasColumn(pool,'analysis_reference_ranges','age_min');
            const colAgeMax = await hasColumn(pool,'analysis_reference_ranges','age_max');
            const colAgeUnit = await hasColumn(pool,'analysis_reference_ranges','age_min_unit');
            const colText = await hasColumn(pool,'analysis_reference_ranges','text_value');
            const colNotes = await hasColumn(pool,'analysis_reference_ranges','notes');
            const colUnit = await hasColumn(pool,'analysis_reference_ranges','unit');
            const cols=['parameter_id']; const vals=['$1']; const rParams=[paramId];
            if (colSex){ cols.push('sex'); vals.push(`$${rParams.length+1}`); rParams.push('Ambos'); }
            if (colAgeMin){ cols.push('age_min'); vals.push(`$${rParams.length+1}`); rParams.push(null); }
            if (colAgeMax){ cols.push('age_max'); vals.push(`$${rParams.length+1}`); rParams.push(null); }
            if (colAgeUnit){ cols.push('age_min_unit'); vals.push(`$${rParams.length+1}`); rParams.push('años'); }
            if (colText){ cols.push('text_value'); vals.push(`$${rParams.length+1}`); rParams.push(null); }
            if (colNotes){ cols.push('notes'); vals.push(`$${rParams.length+1}`); rParams.push('(Texto libre)'); }
            if (colUnit){ cols.push('unit'); vals.push(`$${rParams.length+1}`); rParams.push(p.unit || s.unit || null); }
            await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rParams);
          }
        }
      } else {
        // existing ranges present; if only qualitative, augment with JSON or template
        const { rows: existing } = await pool.query('SELECT id, lower, upper, text_value FROM analysis_reference_ranges WHERE parameter_id=$1', [paramId]);
        const onlyQualitative = existing.length>0 && existing.every(r => r.lower==null && r.upper==null);
        if (onlyQualitative){
          if (ranges.length){
            for (const r of ranges){
              const cols=['parameter_id']; const vals=['$1']; const rp=[paramId];
              cols.push('sex'); vals.push(`$${rp.length+1}`); rp.push(r.sex||'Ambos');
              cols.push('age_min'); vals.push(`$${rp.length+1}`); rp.push(r.age_min ?? null);
              cols.push('age_max'); vals.push(`$${rp.length+1}`); rp.push(r.age_max ?? null);
              cols.push('age_min_unit'); vals.push(`$${rp.length+1}`); rp.push(r.age_min_unit || 'años');
              if (r.lower!=null || r.upper!=null){ cols.push('lower','upper'); vals.push(`$${rp.length+1}`,`$${rp.length+2}`); rp.push(r.lower, r.upper); }
              if (r.text_value!=null){ cols.push('text_value'); vals.push(`$${rp.length+1}`); rp.push(r.text_value); }
              if (r.notes!=null){ cols.push('notes'); vals.push(`$${rp.length+1}`); rp.push(r.notes); }
              if (await hasColumn(pool,'analysis_reference_ranges','unit') && (r.unit!=null || s.unit!=null || p.unit!=null)) { cols.push('unit'); vals.push(`$${rp.length+1}`); rp.push(r.unit||p.unit||s.unit||null); }
              if (await hasColumn(pool,'analysis_reference_ranges','method') && r.method!=null) { cols.push('method'); vals.push(`$${rp.length+1}`); rp.push(r.method); }
              await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rp);
            }
            console.log('[SINGLE][BACKFILL] Rangos numéricos añadidos para %s (reemplazo de cualitativos).', p.name);
          } else {
            const tpl = buildParameterTemplate(p.name);
            if (tpl && Array.isArray(tpl.valorReferencia) && tpl.valorReferencia.length){
              for (const rr of tpl.valorReferencia){
                const cols=['parameter_id']; const vals=['$1']; const rp=[paramId];
                cols.push('sex'); vals.push(`$${rp.length+1}`); rp.push(rr.sexo||'Ambos');
                cols.push('age_min'); vals.push(`$${rp.length+1}`); rp.push(rr.edadMin ?? null);
                cols.push('age_max'); vals.push(`$${rp.length+1}`); rp.push(rr.edadMax ?? null);
                cols.push('age_min_unit'); vals.push(`$${rp.length+1}`); rp.push(rr.unidadEdad || 'años');
                if (rr.valorMin!=null || rr.valorMax!=null){ cols.push('lower','upper'); vals.push(`$${rp.length+1}`,`$${rp.length+2}`); rp.push(rr.valorMin ?? null, rr.valorMax ?? null); }
                if (rr.textoLibre!=null){ cols.push('text_value'); vals.push(`$${rp.length+1}`); rp.push(rr.textoLibre); }
                if (rr.notas!=null){ cols.push('notes'); vals.push(`$${rp.length+1}`); rp.push(rr.notas); }
                if (await hasColumn(pool,'analysis_reference_ranges','unit')) { cols.push('unit'); vals.push(`$${rp.length+1}`); rp.push(tpl.unit || p.unit || s.unit || null); }
                await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rp);
              }
              console.log('[SINGLE][TPL] Rangos desde plantilla añadidos para %s (reemplazo de cualitativos).', p.name);
            }
          }
        }
      }
    }
  }
}

async function seedFromFile(explicitDbName){
  const dbName = explicitDbName || process.env.PGDATABASE || process.env.TENANT_DB || null;
  const filePath = path.resolve(__dirname, 'data', 'single_parameter_studies.json');
  const templatePath = path.resolve(__dirname, 'data', 'single_parameter_studies.template.json');
  const hasFile = fs.existsSync(filePath);
  if (!hasFile){
    console.log('[SINGLE] No se encontró single_parameter_studies.json, usando template de ejemplo (%s).', templatePath);
  }
  const raw = hasFile ? fs.readFileSync(filePath,'utf8') : fs.readFileSync(templatePath,'utf8');
  let list = [];
  try { list = JSON.parse(raw); } catch(e){ console.error('[SINGLE] JSON inválido:', e.message); throw e; }
  if (!Array.isArray(list) || list.length===0){ console.log('[SINGLE] Lista vacía, nada que hacer.'); return { processed: 0 }; }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: clean(process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD),
    database: dbName || process.env.PGDATABASE
  });
  try {
    for (const s of list){
      await upsertStudy(pool, s);
    }
    console.log('[SINGLE] %d estudio(s) procesados.', list.length);
    return { processed: list.length };
  } finally { await pool.end(); }
}

function parseArgs(){
  const out={};
  for (const a of process.argv.slice(2)){
    const m=a.match(/^--([^=]+)=(.*)$/); if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main(){
  const args = parseArgs();
  try {
    await seedFromFile(args.db);
  } catch(e){
    console.error('[SINGLE] Error:', e.message);
    process.exit(1);
  }
}

if (require.main === module){
  main();
}

module.exports = { upsertStudy, seedFromFile };
