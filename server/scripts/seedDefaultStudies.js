#!/usr/bin/env node
/**
 * seedDefaultStudies.js
 * Inserta estudios y parámetros canónicos en una base de datos de tenant recién creada.
 * Uso: node server/scripts/seedDefaultStudies.js --db=lab_mitenant
 * Requiere variables PG* si no se pasa --db.
 */
const { Pool } = require('pg');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* ignore missing .env */ }

function parseArgs(){
  const out={};
  process.argv.slice(2).forEach(a=>{ const m=a.match(/^--([^=]+)=(.*)$/); if(m) out[m[1]]=m[2]; });
  return out;
}

const LIFE_SEGMENTS = [ [0,1],[1,2],[2,12],[12,18],[18,65],[65,120] ];

function placeholderRanges(tipo='numerico'){
  return LIFE_SEGMENTS.map(([a,b])=>({ sexo:'Ambos', edad_min:a, edad_max:b, edad_unit:'años', valor_min:null, valor_max:null, tipo_valor:tipo, texto_permitido:'', texto_libre:'', notas: tipo==='textoLibre' ? '(Cualitativo)' : '(Pendiente definir)' }));
}

// Minimal schema assumptions: studies(id serial, name, category, description, created_at);
// parameters(id serial, study_id, name, unit, decimal_places, position);
// reference_ranges(id serial, parameter_id, sexo, edad_min, edad_max, edad_unit, valor_min, valor_max, tipo_valor, texto_permitido, texto_libre, notas)

const PANELS = [
  { name:'Biometría Hemática', category:'Hematología', params:[ 'Hemoglobina','Hematocrito','Eritrocitos','VCM','HCM','CHCM','RDW','Plaquetas','VMP','Leucocitos Totales','Neutrófilos Segmentados','Neutrófilos Banda','Linfocitos','Monocitos','Eosinófilos','Basófilos','Blastos','Metamielocitos','Mielocitos','Promielocitos' ] },
  { name:'Perfil Tiroideo', category:'Hormonas', params:[ 'TSH','T4 Libre','T4 Total','T3 Total','T3 Libre','Anti-TPO','Anti-TG' ] },
  { name:'Perfil Hepático', category:'Bioquímica', params:[ 'ALT (TGP)','AST (TGO)','Fosfatasa Alcalina','Bilirrubina Total','Bilirrubina Directa','Bilirrubina Indirecta','GGT','Albúmina','Proteínas Totales' ] },
  { name:'Perfil Hormonal', category:'Hormonas', params:[ 'FSH','LH','Prolactina','Estradiol','Progesterona','Testosterona Total','Testosterona Libre','DHEA-S','Cortisol Matutino','Cortisol Vespertino' ] },
  { name:'Perfil Ginecológico', category:'Hormonas', params:[ 'FSH','LH','Prolactina','Estradiol','Progesterona','Androstenediona','AMH','CA-125' ] },
  { name:'Examen General de Orina', category:'Orina', params:[ 'Color Orina','Aspecto Orina','Densidad','pH Orina','Glucosa Orina','Proteínas Orina','Cuerpos Cetónicos','Bilirrubina Orina','Urobilinógeno','Sangre Orina','Nitritos','Esterasa Leucocitaria','Leucocitos (Sedimento)','Eritrocitos (Sedimento)','Células Epiteliales','Bacterias' ] },
  { name:'Perfil Geriátrico', category:'Bioquímica', params:[ 'Glucosa','Creatinina','TSH','Vitamina D 25-OH','Albúmina','Hemoglobina','Colesterol Total','Triglicéridos','HDL','LDL Calculado','Calcio','Fósforo' ] },
  { name:'Química Sanguínea (6 Elementos)', category:'Bioquímica', params:[ 'Glucosa','Urea','Creatinina','Ácido Úrico','Colesterol Total','Triglicéridos' ] },
  { name:'Electrolitos', category:'Bioquímica', params:[ 'Sodio','Potasio','Cloro','Calcio Ionizado','Magnesio','Bicarbonato','Fósforo' ] },
  { name:'Perfil Preoperatorio', category:'Hematología', params:[ 'Hemoglobina','Hematocrito','Glucosa','Creatinina','Plaquetas','TP','INR','TTPa','Grupo Sanguíneo','Factor Rh' ] },
  { name:'Tipo de Sangre y RH', category:'Hematología', params:[ 'Grupo Sanguíneo','Factor Rh','Coombs Directo' ] },
  { name:'Perfil Lipídico', category:'Bioquímica', params:[ 'Colesterol Total','Triglicéridos','HDL','LDL Calculado','VLDL','Colesterol No-HDL' ] },
  { name:'Perfil Renal', category:'Bioquímica', params:[ 'Urea','BUN','Creatinina','Ácido Úrico','Depuración Creatinina','Calcio','Fósforo' ] },
  { name:'Perfil Cardíaco', category:'Bioquímica', params:[ 'Troponina I','CK Total','CK-MB','DHL','Mioglobina','BNP','Dímero D' ] }
];

const { buildParameterTemplate } = require('../utils/referenceTemplates');

async function seed(pool){
  // Detectar solo uso del catálogo moderno si existe 'analysis'; si no, fallback legacy
  const modeModern = (await pool.query("SELECT to_regclass('public.analysis') AS t")).rows[0].t ? true : false;
  const hasAnalysisParams = modeModern && (await pool.query("SELECT to_regclass('public.analysis_parameters') AS t")).rows[0].t ? true : false;
  const hasModernRanges = modeModern && (await pool.query("SELECT to_regclass('public.analysis_reference_ranges') AS t")).rows[0].t ? true : false;

  for (const panel of PANELS){
    if (modeModern) {
      // Modern path: wrap each panel in a savepoint so fallos no contaminan los demás
      await pool.query('BEGIN');
      try {
        const { rows: aExist } = await pool.query('SELECT id FROM analysis WHERE LOWER(name)=LOWER($1) LIMIT 1',[panel.name]);
        let analysisId = aExist[0]?.id;
        if (!analysisId){
          let code = null; try { const { rows: cnt } = await pool.query('SELECT COUNT(*)::int c FROM analysis'); code = `A${String(cnt[0].c+1).padStart(4,'0')}`; } catch(_){ /* ignore */ }
          const insertCols=['name']; const insertVals=['$1']; const params=[panel.name];
          if (await hasColumn(pool,'analysis','category')) { insertCols.push('category'); insertVals.push(`$${params.length+1}`); params.push(panel.category); }
          if (await hasColumn(pool,'analysis','code')) { insertCols.push('code'); insertVals.push(`$${params.length+1}`); params.push(code); }
          // Nuevos metadatos (migración 0007): description, indications, sample_type, sample_container, processing_time_hours, general_units
          // Sólo insertar si la columna existe para mantener compatibilidad con tenants antiguos.
          if (panel.description && await hasColumn(pool,'analysis','description')) { insertCols.push('description'); insertVals.push(`$${params.length+1}`); params.push(panel.description); }
          if (panel.indications && await hasColumn(pool,'analysis','indications')) { insertCols.push('indications'); insertVals.push(`$${params.length+1}`); params.push(panel.indications); }
            if (panel.sample_type && await hasColumn(pool,'analysis','sample_type')) { insertCols.push('sample_type'); insertVals.push(`$${params.length+1}`); params.push(panel.sample_type); }
            if (panel.sample_container && await hasColumn(pool,'analysis','sample_container')) { insertCols.push('sample_container'); insertVals.push(`$${params.length+1}`); params.push(panel.sample_container); }
            if (panel.processing_time_hours!=null && await hasColumn(pool,'analysis','processing_time_hours')) { insertCols.push('processing_time_hours'); insertVals.push(`$${params.length+1}`); params.push(panel.processing_time_hours); }
            if (panel.general_units && await hasColumn(pool,'analysis','general_units')) { insertCols.push('general_units'); insertVals.push(`$${params.length+1}`); params.push(panel.general_units); }
          const { rows: aRows } = await pool.query(`INSERT INTO analysis(${insertCols.join(',')}) VALUES(${insertVals.join(',')}) RETURNING id`, params);
          analysisId = aRows[0].id;
        }
        if (hasAnalysisParams){
          for (let idx=0; idx<panel.params.length; idx++){
            const pName = panel.params[idx];
            const tpl = buildParameterTemplate(pName);
            const unit = tpl?.unit || null;
            const decimals = tpl?.decimal_places || null;
            const { rows: pExist } = await pool.query('SELECT id FROM analysis_parameters WHERE analysis_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1',[analysisId, pName]);
            let paramId = pExist[0]?.id;
            if (!paramId){
              const pCols=['analysis_id','name']; const pVals=['$1','$2']; const pParams=[analysisId,pName];
              if (await hasColumn(pool,'analysis_parameters','unit')) { pCols.push('unit'); pVals.push(`$${pParams.length+1}`); pParams.push(unit); }
              if (await hasColumn(pool,'analysis_parameters','position')) { pCols.push('position'); pVals.push(`$${pParams.length+1}`); pParams.push(idx+1); }
              if (await hasColumn(pool,'analysis_parameters','decimal_places')) { pCols.push('decimal_places'); pVals.push(`$${pParams.length+1}`); pParams.push(decimals); }
              const { rows: insP } = await pool.query(`INSERT INTO analysis_parameters(${pCols.join(',')}) VALUES(${pVals.join(',')}) RETURNING id`, pParams);
              paramId = insP[0].id;
              // Insert ranges for newly created parameter
              if (hasModernRanges && tpl?.valorReferencia?.length){
                const colSex = await hasColumn(pool,'analysis_reference_ranges','sex');
                const colAgeMin = await hasColumn(pool,'analysis_reference_ranges','age_min');
                const colAgeMax = await hasColumn(pool,'analysis_reference_ranges','age_max');
                const colAgeUnit = await hasColumn(pool,'analysis_reference_ranges','age_min_unit');
                const colLower = await hasColumn(pool,'analysis_reference_ranges','lower');
                const colText = await hasColumn(pool,'analysis_reference_ranges','text_value');
                const colNotes = await hasColumn(pool,'analysis_reference_ranges','notes');
                const colUnit = await hasColumn(pool,'analysis_reference_ranges','unit');
                for (const rr of tpl.valorReferencia){
                  const cols=['parameter_id']; const vals=['$1']; const rParams=[paramId];
                  if (colSex){ cols.push('sex'); vals.push(`$${rParams.length+1}`); rParams.push(rr.sexo||'Ambos'); }
                  if (colAgeMin){ cols.push('age_min'); vals.push(`$${rParams.length+1}`); rParams.push(rr.edadMin ?? null); }
                  if (colAgeMax){ cols.push('age_max'); vals.push(`$${rParams.length+1}`); rParams.push(rr.edadMax ?? null); }
                  if (colAgeUnit){ cols.push('age_min_unit'); vals.push(`$${rParams.length+1}`); rParams.push(rr.unidadEdad || 'años'); }
                  if (colLower){ cols.push('lower','upper'); vals.push(`$${rParams.length+1}`,`$${rParams.length+2}`); rParams.push(rr.valorMin ?? null, rr.valorMax ?? null); }
                  if (colText){ cols.push('text_value'); vals.push(`$${rParams.length+1}`); rParams.push(rr.textoLibre || null); }
                  if (colNotes){ cols.push('notes'); vals.push(`$${rParams.length+1}`); rParams.push(rr.notas || null); }
                  if (colUnit){ cols.push('unit'); vals.push(`$${rParams.length+1}`); rParams.push(tpl.unit || null); }
                  await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rParams);
                }
              }
            } else if (hasModernRanges) {
              // Backfill ranges if parameter existed but has none
              if (tpl?.valorReferencia?.length){
                const { rows: cntR } = await pool.query('SELECT COUNT(*)::int c FROM analysis_reference_ranges WHERE parameter_id=$1',[paramId]);
                if (cntR[0].c === 0){
                  const colSex = await hasColumn(pool,'analysis_reference_ranges','sex');
                  const colAgeMin = await hasColumn(pool,'analysis_reference_ranges','age_min');
                  const colAgeMax = await hasColumn(pool,'analysis_reference_ranges','age_max');
                  const colAgeUnit = await hasColumn(pool,'analysis_reference_ranges','age_min_unit');
                  const colLower = await hasColumn(pool,'analysis_reference_ranges','lower');
                  const colText = await hasColumn(pool,'analysis_reference_ranges','text_value');
                  const colNotes = await hasColumn(pool,'analysis_reference_ranges','notes');
                  const colUnit = await hasColumn(pool,'analysis_reference_ranges','unit');
                  for (const rr of tpl.valorReferencia){
                    const cols=['parameter_id']; const vals=['$1']; const rParams=[paramId];
                    if (colSex){ cols.push('sex'); vals.push(`$${rParams.length+1}`); rParams.push(rr.sexo||'Ambos'); }
                    if (colAgeMin){ cols.push('age_min'); vals.push(`$${rParams.length+1}`); rParams.push(rr.edadMin ?? null); }
                    if (colAgeMax){ cols.push('age_max'); vals.push(`$${rParams.length+1}`); rParams.push(rr.edadMax ?? null); }
                    if (colAgeUnit){ cols.push('age_min_unit'); vals.push(`$${rParams.length+1}`); rParams.push(rr.unidadEdad || 'años'); }
                    if (colLower){ cols.push('lower','upper'); vals.push(`$${rParams.length+1}`,`$${rParams.length+2}`); rParams.push(rr.valorMin ?? null, rr.valorMax ?? null); }
                    if (colText){ cols.push('text_value'); vals.push(`$${rParams.length+1}`); rParams.push(rr.textoLibre || null); }
                    if (colNotes){ cols.push('notes'); vals.push(`$${rParams.length+1}`); rParams.push(rr.notas || null); }
                    if (colUnit){ cols.push('unit'); vals.push(`$${rParams.length+1}`); rParams.push(tpl.unit || null); }
                    await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rParams);
                  }
                  console.log('[SEED][BACKFILL] Ranges añadidos para parámetro existente %s', pName);
                }
              }
            }
          }
        }
        await pool.query('COMMIT');
        console.log('[SEED] (analysis) Insertado %s con %d parámetros', panel.name, panel.params.length);
      } catch(e){
        await pool.query('ROLLBACK');
        console.warn('[SEED] Panel %s abortado: %s', panel.name, e.message);
      }
    } else {
      // Legacy path (studies)
      const { rows: exist } = await pool.query('SELECT id FROM studies WHERE LOWER(name)=LOWER($1) LIMIT 1',[panel.name]);
      if (exist[0]) continue;
      await pool.query('BEGIN');
      try {
        const { rows: sRows } = await pool.query('INSERT INTO studies(name, category, description) VALUES($1,$2,$3) RETURNING id',[panel.name, panel.category, panel.description||'']);
        const studyId = sRows[0].id;
        for (let idx=0; idx<panel.params.length; idx++){
          const pName = panel.params[idx];
          const tpl = buildParameterTemplate(pName);
            const unit = tpl?.unit || '';
            const decimals = tpl?.decimal_places || 0;
            const { rows: pRows } = await pool.query('INSERT INTO parameters(study_id, name, unit, decimal_places, position) VALUES($1,$2,$3,$4,$5) RETURNING id',[studyId, pName, unit, decimals, idx+1]);
            const paramId = pRows[0].id;
            const ranges = tpl ? tpl.valorReferencia : placeholderRanges(tpl && tpl.valorReferencia && tpl.valorReferencia[0]?.tipoValor === 'textoLibre' ? 'textoLibre':'numerico');
            for (const r of ranges){
              await pool.query(`INSERT INTO reference_ranges(parameter_id, sexo, edad_min, edad_max, edad_unit, valor_min, valor_max, tipo_valor, texto_permitido, texto_libre, notas)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[
                paramId, r.sexo||'Ambos', r.edadMin, r.edadMax, r.unidadEdad||'años', r.valorMin, r.valorMax, r.tipoValor||'numerico', r.textoPermitido||'', r.textoLibre||'', r.notas||''
              ]);
            }
        }
        await pool.query('COMMIT');
        console.log('[SEED] Insertado estudio %s con %d parámetros (legacy)', panel.name, panel.params.length);
      } catch(e){ await pool.query('ROLLBACK'); console.warn('[SEED] Panel legacy %s abortado: %s', panel.name, e.message); }
    }
  }
}

async function hasColumn(pool, table, column){
  const { rows } = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`,[table, column]);
  return !!rows[0];
}

async function main(){
  const args = parseArgs();
  const dbName = args.db || process.env.PGDATABASE;
  if (!dbName){
    console.error('Debe indicar --db=nombre_db o configurar PGDATABASE');
    process.exit(1);
  }
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName
  });
  try {
    await seed(pool);
  } catch(e){
    console.error('[SEED] Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module){
  main();
}

module.exports = { PANELS, seed };
