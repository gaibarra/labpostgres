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

function normalizeName(str){
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function deriveCodeFromName(name) {
  const clean = (name || 'AUTO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
    .toUpperCase();
  return clean || `AUTO_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

// Minimal schema assumptions: studies(id serial, name, category, description, created_at);
// parameters(id serial, study_id, name, unit, decimal_places, position);
// reference_ranges(id serial, parameter_id, sexo, edad_min, edad_max, edad_unit, valor_min, valor_max, tipo_valor, texto_permitido, texto_libre, notas)

// Catálogo de metadatos por panel (clave, descripción, indicaciones, tipo de muestra, contenedor, tiempo proceso)
const PANELS = [
  { code:'BH', name:'Biometría Hemática', category:'Hematología',
    description:'Conteo sanguíneo completo para valoración hematológica.',
    indications:'Evaluación general, anemia, infecciones, seguimiento clínico.',
    sample_type:'Sangre total', sample_container:'Tubo morado (EDTA)', processing_time_hours: 2,
    params:[ 'Hemoglobina','Hematocrito','Eritrocitos','VCM','HCM','CHCM','RDW','Plaquetas','VMP','Leucocitos Totales','Neutrófilos Segmentados','Neutrófilos Banda','Linfocitos','Monocitos','Eosinófilos','Basófilos','Blastos','Metamielocitos','Mielocitos','Promielocitos' ] },
  { code:'PTI', name:'Perfil Tiroideo', category:'Hormonas',
    description:'Evaluación de función tiroidea con hormonas y anticuerpos.',
    indications:'Hipotiroidismo/hipertiroidismo, seguimiento tratamiento.',
    sample_type:'Suero', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 24,
    params:[ 'TSH','T4 Libre','T4 Total','T3 Total','T3 Libre','Anti-TPO','Anti-TG' ] },
  { code:'PHEP', name:'Perfil Hepático', category:'Bioquímica',
    description:'Enzimas y metabolitos para evaluación de función hepática.',
    indications:'Daño hepático, colestasis, seguimiento de hepatopatías.',
    sample_type:'Suero', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 8,
    params:[ 'ALT (TGP)','AST (TGO)','Fosfatasa Alcalina','Bilirrubina Total','Bilirrubina Directa','Bilirrubina Indirecta','GGT','Albúmina','Proteínas Totales' ] },
  
  { code:'PGIN', name:'Perfil Ginecológico', category:'Hormonas',
    description:'Hormonas y marcadores asociados a salud ginecológica.',
    indications:'Trastornos menstruales, fertilidad, SOP, seguimiento.',
    sample_type:'Suero', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 24,
    params:[ 'FSH','LH','Prolactina','Estradiol','Progesterona','Androstenediona','AMH','CA-125' ] },
  { code:'PHG', name:'Perfil Hormonal General', category:'Hormonas',
    description:'Perfil hormonal integral con eje gonadal y adrenal con rangos por tramos de edad (0–120) y diferenciación por sexo en adultos.',
    indications:'Evaluación endocrina general (pubertad, hipogonadismo, SOP, disfunción adrenal/hipofisaria).',
    sample_type:'Suero (preferible 8–10 am para cortisol)', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 24,
  params:[ 'FSH','LH','Prolactina','Estrona (E1)','Estradiol','Estriol (E3)','Progesterona','Testosterona Total','Testosterona Libre','DHEA-S','Androstenediona','AMH','SHBG','IGF-1','GH','DHT','Cortisol Matutino','Cortisol Vespertino','ACTH' ] },
  { code:'EGO', name:'Examen General de Orina', category:'Orina',
    description:'Análisis físico-químico y microscópico de orina.',
    indications:'Evaluación renal/urinaria, infecciones urinarias, tamizaje.',
    sample_type:'Orina', sample_container:'Vaso estéril de orina', processing_time_hours: 1,
    params:[ 'Color Orina','Aspecto Orina','Densidad','pH Orina','Glucosa Orina','Proteínas Orina','Cuerpos Cetónicos','Bilirrubina Orina','Urobilinógeno','Sangre Orina','Nitritos','Esterasa Leucocitaria','Leucocitos (Sedimento)','Eritrocitos (Sedimento)','Células Epiteliales','Bacterias' ] },
  { code:'PGER', name:'Perfil Geriátrico', category:'Bioquímica',
    description:'Panel orientado a evaluación integral en adultos mayores.',
    indications:'Tamizaje y seguimiento en población geriátrica.',
    sample_type:'Suero', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 8,
    params:[ 'Glucosa','Creatinina','TSH','Vitamina D 25-OH','Albúmina','Hemoglobina','Colesterol Total','Triglicéridos','HDL','LDL Calculado','Calcio','Fósforo' ] },
  { code:'QS6', name:'Química Sanguínea (6 Elementos)', category:'Bioquímica',
    description:'Metabolitos básicos para evaluación metabólica.',
    indications:'Tamizaje general, control de padecimientos crónicos.',
    sample_type:'Suero', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 4,
    params:[ 'Glucosa','Urea','Creatinina','Ácido Úrico','Colesterol Total','Triglicéridos' ] },
  { code:'ELEC', name:'Electrolitos', category:'Bioquímica',
    description:'Determinación de electrolitos séricos principales.',
    indications:'Balance hidroelectrolítico, trastornos ácido-base.',
    sample_type:'Suero', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 2,
    params:[ 'Sodio','Potasio','Cloro','Calcio Ionizado','Magnesio','Bicarbonato','Fósforo' ] },
  { code:'PREOP', name:'Perfil Preoperatorio', category:'Hematología',
    description:'Panel prequirúrgico básico para evaluación de riesgo.',
    indications:'Estudios previos a procedimientos quirúrgicos.',
    sample_type:'Sangre total y suero', sample_container:'Tubo morado (EDTA) y tubo rojo/amarillo (SST)', processing_time_hours: 6,
    params:[ 'Hemoglobina','Hematocrito','Glucosa','Creatinina','Plaquetas','TP','INR','TTPa','Grupo Sanguíneo','Factor Rh' ] },
  { code:'ABO', name:'Tipo de Sangre y RH', category:'Hematología',
    description:'Determinación de grupo ABO y factor Rh.',
    indications:'Transfusiones, embarazo, procedimientos invasivos.',
    sample_type:'Sangre total', sample_container:'Tubo morado (EDTA)', processing_time_hours: 2,
    params:[ 'Grupo Sanguíneo','Factor Rh','Coombs Directo' ] },
  { code:'PLIP', name:'Perfil Lipídico', category:'Bioquímica',
    description:'Lípidos sanguíneos para riesgo cardiovascular.',
    indications:'Tamizaje y seguimiento de dislipidemias.',
    sample_type:'Suero (ayuno recomendado)', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 6,
    params:[ 'Colesterol Total','Triglicéridos','HDL','LDL Calculado','VLDL','Colesterol No-HDL' ] },
  { code:'PREN', name:'Perfil Renal', category:'Bioquímica',
    description:'Evaluación de función renal y metabolismo mineral.',
    indications:'Enfermedad renal, evaluación metabólica.',
    sample_type:'Suero', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 4,
    params:[ 'Urea','BUN','Creatinina','Ácido Úrico','Depuración Creatinina','Calcio','Fósforo' ] },
  { code:'PCAR', name:'Perfil Cardíaco', category:'Bioquímica',
    description:'Marcadores cardíacos y enzimáticos.',
    indications:'Dolor torácico, isquemia, seguimiento.',
    sample_type:'Suero', sample_container:'Tubo rojo o amarillo (SST)', processing_time_hours: 4,
    params:[ 'Troponina I','CK Total','CK-MB','DHL','Mioglobina','BNP','Dímero D' ] }
  ,{ code:'ABG', name:'Antibiograma', category:'Microbiología',
    description:'Prueba de susceptibilidad antimicrobiana por antibiótico (S/I/R) con valor de MIC o zona según método.',
    indications:'Infecciones bacterianas: reporte de susceptibilidad para guiar terapéutica.',
    sample_type:'Aislamiento bacteriano (hisopo, orina, sangre, etc.)', sample_container:'Medio de cultivo adecuado', processing_time_hours: 48,
    params: [ 'Organismo', 'Método (Kirby-Bauer/MIC/Etest)', 'Estándar (CLSI/EUCAST)', 'Versión Estándar' ] }
  ,{ code:'EMF', name:'Estudio de Materia fecal', category:'Coprología',
    description:'Evaluación macroscópica y microscópica básica de heces.',
    indications:'Diarrea, dolor abdominal, malabsorción, pesquisa general.',
    sample_type:'Materia fecal', sample_container:'Frasco estéril para heces', processing_time_hours: 4,
    params:[ 'Color Heces','Consistencia','Moco en Heces','Sangre Oculta','pH Fecal','Azúcares Reductores','Grasas Fecales','Leucocitos Fecales','Eritrocitos Fecales','Restos Alimenticios' ] }
  ,{ code:'COPRO', name:'Coproparasitoscópico', category:'Parasitología',
    description:'Búsqueda e identificación de parásitos intestinales en heces (quistes, trofozoítos, huevos, larvas).',
    indications:'Diarrea, dolor abdominal, parasitosis, control post-tratamiento.',
    sample_type:'Materia fecal', sample_container:'Frasco estéril (con o sin conservador según técnica)', processing_time_hours: 24,
    params:[ 'Quistes','Trofozoítos','Huevos de Helmintos','Larvas','Levaduras','Flora Bacteriana','Moco','Leucocitos Fecales','Eritrocitos Fecales' ] }
];

const { buildParameterTemplate } = require('../utils/referenceTemplates');
const { enforceAdultSexPairs } = require('./enforceAdultSexPairs');

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
        // Buscar por name o por code (si la columna existe)
        let aExist = [];
        try {
          const hasCode = await hasColumn(pool,'analysis','code');
          if (hasCode && panel.code) {
            const q = 'SELECT id FROM analysis WHERE LOWER(name)=LOWER($1) OR LOWER(code)=LOWER($2) LIMIT 1';
            const r = await pool.query(q, [panel.name, panel.code]);
            aExist = r.rows;
          } else {
            const r = await pool.query('SELECT id FROM analysis WHERE LOWER(name)=LOWER($1) LIMIT 1',[panel.name]);
            aExist = r.rows;
          }
        } catch(_) { aExist = []; }
  let analysisId = aExist[0]?.id;
        if (!analysisId){
          // Preferir clave canónica del panel; fallback a consecutivo A####
          let code = panel.code || null;
          if (!code) { try { const { rows: cnt } = await pool.query('SELECT COUNT(*)::int c FROM analysis'); code = `A${String(cnt[0].c+1).padStart(4,'0')}`; } catch(_){ /* ignore */ }
          }
          const insertCols=['name']; const insertVals=['$1']; const params=[panel.name];
          if (await hasColumn(pool,'analysis','category')) { insertCols.push('category'); insertVals.push(`$${params.length+1}`); params.push(panel.category); }
          const hasCodeCol = await hasColumn(pool,'analysis','code');
          const hasClaveCol = await hasColumn(pool,'analysis','clave');
          if (hasCodeCol && hasClaveCol) {
            insertCols.push('code'); insertVals.push(`$${params.length+1}`); params.push(code);
            insertCols.push('clave'); insertVals.push(`$${params.length+1}`); params.push(code);
          } else if (hasCodeCol) {
            insertCols.push('code'); insertVals.push(`$${params.length+1}`); params.push(code);
          } else if (hasClaveCol) {
            insertCols.push('clave'); insertVals.push(`$${params.length+1}`); params.push(code);
          }
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
        } else {
          // Si ya existe, intentar completar metadatos faltantes de forma idempotente
          const hasCodeCol = await hasColumn(pool,'analysis','code');
          const hasClaveCol = await hasColumn(pool,'analysis','clave');
          const sets = [];
          const vals = [];
          if (hasCodeCol) { sets.push(`code = COALESCE(code, $${sets.length+1})`); vals.push(panel.code || null); }
          if (hasClaveCol) { sets.push(`clave = COALESCE(clave, $${sets.length+1})`); vals.push(panel.code || null); }
          if (await hasColumn(pool,'analysis','category')) { sets.push(`category = COALESCE(category, $${sets.length+1})`); vals.push(panel.category || null); }
          if (await hasColumn(pool,'analysis','description')) { sets.push(`description = COALESCE(description, $${sets.length+1})`); vals.push(panel.description || null); }
          if (await hasColumn(pool,'analysis','indications')) { sets.push(`indications = COALESCE(indications, $${sets.length+1})`); vals.push(panel.indications || null); }
          if (await hasColumn(pool,'analysis','sample_type')) { sets.push(`sample_type = COALESCE(sample_type, $${sets.length+1})`); vals.push(panel.sample_type || null); }
          if (await hasColumn(pool,'analysis','sample_container')) { sets.push(`sample_container = COALESCE(sample_container, $${sets.length+1})`); vals.push(panel.sample_container || null); }
          if (await hasColumn(pool,'analysis','processing_time_hours')) { sets.push(`processing_time_hours = COALESCE(processing_time_hours, $${sets.length+1})`); vals.push(panel.processing_time_hours ?? null); }
          if (await hasColumn(pool,'analysis','general_units') && panel.general_units) { sets.push(`general_units = COALESCE(general_units, $${sets.length+1})`); vals.push(panel.general_units); }
          if (sets.length) {
            vals.push(analysisId);
            await pool.query(`UPDATE analysis SET ${sets.join(', ')} WHERE id = $${vals.length}`,[...vals]);
          }
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
              } else if (hasModernRanges) {
                // No template ranges provided: create a default qualitative (free-text) range
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
                if (colUnit){ cols.push('unit'); vals.push(`$${rParams.length+1}`); rParams.push(unit || null); }
                await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rParams);
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
              } else {
                // No template ranges and parameter exists without ranges: add default qualitative range
                const { rows: cntR } = await pool.query('SELECT COUNT(*)::int c FROM analysis_reference_ranges WHERE parameter_id=$1',[paramId]);
                if (cntR[0].c === 0){
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
                  if (colUnit){ cols.push('unit'); vals.push(`$${rParams.length+1}`); rParams.push(tpl?.unit || null); }
                  await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, rParams);
                  console.log('[SEED][BACKFILL] Rango cualitativo por defecto añadido para parámetro existente %s', pName);
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
  // Enforce sex pairs for adult hormonal parameters after seeding all panels (modern path)
  try {
    const { rows: hasModern } = await pool.query("SELECT to_regclass('public.analysis_reference_ranges') AS t");
    if (hasModern[0]?.t) {
      const res = await enforceAdultSexPairs(pool, { like: 'hormona|hormonal|ginecol', write: true });
      console.log('[SEED] Enforcer M/F adultos aplicado:', JSON.stringify({ matched: res.matchedParameters, inserted: res.inserted }));
    }
  } catch (e) {
    console.warn('[SEED] Enforcer M/F adultos: aviso %s', e.message);
  }

  // Crear paquetes automáticamente a partir de análisis "Perfil"
  if (modeModern) {
    await bootstrapPackagesFromProfiles(pool);
  }
}

async function hasColumn(pool, table, column){
  const { rows } = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`,[table, column]);
  return !!rows[0];
}

async function bootstrapPackagesFromProfiles(pool) {
  const supportsPkg = (await pool.query("SELECT to_regclass('public.analysis_packages') AS t")).rows[0]?.t;
  const supportsItems = (await pool.query("SELECT to_regclass('public.analysis_package_items') AS t")).rows[0]?.t;
  const supportsPosition = supportsItems && (await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='analysis_package_items' AND column_name='position' LIMIT 1`)).rows.length === 1;
  const packagesHasSlug = supportsPkg ? await hasColumn(pool, 'analysis_packages', 'slug') : false;
  const analysisHasPackageId = await hasColumn(pool,'analysis','package_id');
  if (!supportsPkg || !supportsItems) {
    console.log('[SEED][PACKAGES] Tablas analysis_packages o analysis_package_items ausentes; se omite conversión de perfiles.');
    return;
  }

  const analysisColumnFlags = {
    code: await hasColumn(pool,'analysis','code'),
    clave: await hasColumn(pool,'analysis','clave'),
    category: await hasColumn(pool,'analysis','category'),
    description: await hasColumn(pool,'analysis','description'),
    indications: await hasColumn(pool,'analysis','indications'),
    sample_type: await hasColumn(pool,'analysis','sample_type'),
    sample_container: await hasColumn(pool,'analysis','sample_container'),
    processing_time_hours: await hasColumn(pool,'analysis','processing_time_hours'),
    general_units: await hasColumn(pool,'analysis','general_units')
  };

  const parameterColumnFlags = {
    unit: await hasColumn(pool,'analysis_parameters','unit'),
    decimal_places: await hasColumn(pool,'analysis_parameters','decimal_places'),
    position: await hasColumn(pool,'analysis_parameters','position')
  };

  const hasRangesTable = (await pool.query("SELECT to_regclass('public.analysis_reference_ranges') AS t")).rows[0]?.t;
  const rangeColumnFlags = hasRangesTable ? {
    sex: await hasColumn(pool,'analysis_reference_ranges','sex'),
    age_min: await hasColumn(pool,'analysis_reference_ranges','age_min'),
    age_max: await hasColumn(pool,'analysis_reference_ranges','age_max'),
    age_min_unit: await hasColumn(pool,'analysis_reference_ranges','age_min_unit'),
    lower: await hasColumn(pool,'analysis_reference_ranges','lower'),
    upper: await hasColumn(pool,'analysis_reference_ranges','upper'),
    text_value: await hasColumn(pool,'analysis_reference_ranges','text_value'),
    notes: await hasColumn(pool,'analysis_reference_ranges','notes'),
    unit: await hasColumn(pool,'analysis_reference_ranges','unit'),
    method: await hasColumn(pool,'analysis_reference_ranges','method')
  } : {};

  const { rows: analysisRows } = await pool.query('SELECT id, name FROM analysis');
  if (!analysisRows.length) {
    console.log('[SEED][PACKAGES] No hay análisis disponibles para asociar a los paquetes.');
    return;
  }
  const analysisByName = new Map();
  for (const row of analysisRows) {
    const key = normalizeName(row.name);
    if (key && !analysisByName.has(key)) {
      analysisByName.set(key, row.id);
    }
  }
  if (!analysisByName.size) {
    console.log('[SEED][PACKAGES] No se pudieron normalizar nombres de análisis para vincular.');
    return;
  }

  const { rowCount: danglingRemoved } = await pool.query(`
    DELETE FROM analysis_package_items
    WHERE item_type='analysis'
      AND NOT EXISTS (SELECT 1 FROM analysis a WHERE a.id = analysis_package_items.item_id)
  `);
  if (danglingRemoved) {
    console.log('[SEED][PACKAGES] Ítems huérfanos removidos: %d', danglingRemoved);
  }

  const profileSelect = [
    'id',
    'name',
    analysisColumnFlags.description ? "COALESCE(description,'Perfil clínico') AS description" : "'Perfil clínico'::text AS description",
    analysisColumnFlags.category ? 'category' : 'NULL::text AS category',
    analysisColumnFlags.sample_type ? 'sample_type' : 'NULL::text AS sample_type',
    analysisColumnFlags.sample_container ? 'sample_container' : 'NULL::text AS sample_container',
    analysisColumnFlags.processing_time_hours ? 'processing_time_hours' : 'NULL::int AS processing_time_hours'
  ];
  const profilesSql = `SELECT ${profileSelect.join(', ')} FROM analysis WHERE name ILIKE 'perfil %'`;
  const { rows: profiles } = await pool.query(profilesSql);
  if (!profiles.length) {
    console.log('[SEED][PACKAGES] No se encontraron análisis con nombre Perfil*.');
    return;
  }

  const paramSelect = [
    'id',
    'name',
    parameterColumnFlags.unit ? 'unit' : 'NULL::text AS unit',
    parameterColumnFlags.decimal_places ? 'decimal_places' : 'NULL::int AS decimal_places'
  ];
  const paramOrderClause = parameterColumnFlags.position ? 'ORDER BY position' : 'ORDER BY name';
  const paramsSql = `SELECT ${paramSelect.join(', ')} FROM analysis_parameters WHERE analysis_id=$1 ${paramOrderClause}`;

  const missingNames = new Map();
  let linkedItems = 0;
  let packagesTouched = 0;
  let createdAnalyses = 0;

  async function cloneRanges(sourceParamId, targetParamId) {
    if (!hasRangesTable) return;
    const { rows } = await pool.query('SELECT * FROM analysis_reference_ranges WHERE parameter_id=$1', [sourceParamId]);
    for (const range of rows) {
      const cols = ['parameter_id'];
      const vals = ['$1'];
      const params = [targetParamId];
      if (rangeColumnFlags.sex) { cols.push('sex'); vals.push(`$${params.length+1}`); params.push(range.sex || 'Ambos'); }
      if (rangeColumnFlags.age_min) { cols.push('age_min'); vals.push(`$${params.length+1}`); params.push(range.age_min ?? null); }
      if (rangeColumnFlags.age_max) { cols.push('age_max'); vals.push(`$${params.length+1}`); params.push(range.age_max ?? null); }
      if (rangeColumnFlags.age_min_unit) { cols.push('age_min_unit'); vals.push(`$${params.length+1}`); params.push(range.age_min_unit || 'años'); }
      if (rangeColumnFlags.lower) { cols.push('lower'); vals.push(`$${params.length+1}`); params.push(range.lower ?? null); }
      if (rangeColumnFlags.upper) { cols.push('upper'); vals.push(`$${params.length+1}`); params.push(range.upper ?? null); }
      if (rangeColumnFlags.text_value) { cols.push('text_value'); vals.push(`$${params.length+1}`); params.push(range.text_value ?? null); }
      if (rangeColumnFlags.notes) { cols.push('notes'); vals.push(`$${params.length+1}`); params.push(range.notes ?? null); }
      if (rangeColumnFlags.unit) { cols.push('unit'); vals.push(`$${params.length+1}`); params.push(range.unit ?? null); }
      if (rangeColumnFlags.method) { cols.push('method'); vals.push(`$${params.length+1}`); params.push(range.method ?? null); }
      await pool.query(`INSERT INTO analysis_reference_ranges(${cols.join(',')}) VALUES(${vals.join(',')})`, params);
    }
  }

  async function ensureStandaloneAnalysis(paramRow, profMeta) {
    const normalized = normalizeName(paramRow.name);
    if (!normalized) return null;
    const cached = analysisByName.get(normalized);
    if (cached) return cached;

    const insertCols = ['name'];
    const insertVals = ['$1'];
    const insertParams = [paramRow.name];
    if (analysisColumnFlags.category) { insertCols.push('category'); insertVals.push(`$${insertParams.length+1}`); insertParams.push(profMeta.category || 'Perfil'); }
    if (analysisColumnFlags.description) {
      insertCols.push('description'); insertVals.push(`$${insertParams.length+1}`);
      insertParams.push(`Subestudio del ${profMeta.name}`);
    }
    if (analysisColumnFlags.indications) { insertCols.push('indications'); insertVals.push(`$${insertParams.length+1}`); insertParams.push(`Derivado del ${profMeta.name}`); }
    if (analysisColumnFlags.sample_type) { insertCols.push('sample_type'); insertVals.push(`$${insertParams.length+1}`); insertParams.push(profMeta.sample_type || null); }
    if (analysisColumnFlags.sample_container) { insertCols.push('sample_container'); insertVals.push(`$${insertParams.length+1}`); insertParams.push(profMeta.sample_container || null); }
    if (analysisColumnFlags.processing_time_hours) { insertCols.push('processing_time_hours'); insertVals.push(`$${insertParams.length+1}`); insertParams.push(profMeta.processing_time_hours ?? null); }
    if (analysisColumnFlags.general_units) { insertCols.push('general_units'); insertVals.push(`$${insertParams.length+1}`); insertParams.push(paramRow.unit || null); }
    if (analysisColumnFlags.code) { insertCols.push('code'); insertVals.push(`$${insertParams.length+1}`); insertParams.push(`${deriveCodeFromName(paramRow.name)}_PF`); }
    if (analysisColumnFlags.clave) { insertCols.push('clave'); insertVals.push(`$${insertParams.length+1}`); insertParams.push(`${deriveCodeFromName(paramRow.name)}_PF`); }

    let newAnalysisId;
    try {
      const { rows: created } = await pool.query(`INSERT INTO analysis(${insertCols.join(',')}) VALUES(${insertVals.join(',')}) RETURNING id`, insertParams);
      newAnalysisId = created[0].id;
    } catch (err) {
      console.warn('[SEED][PACKAGES] No se pudo crear análisis individual %s: %s', paramRow.name, err.message);
      return null;
    }

    const paramCols = ['analysis_id','name'];
    const paramVals = ['$1','$2'];
    const paramParams = [newAnalysisId, paramRow.name];
    if (parameterColumnFlags.unit) { paramCols.push('unit'); paramVals.push(`$${paramParams.length+1}`); paramParams.push(paramRow.unit || null); }
    if (parameterColumnFlags.decimal_places) { paramCols.push('decimal_places'); paramVals.push(`$${paramParams.length+1}`); paramParams.push(paramRow.decimal_places ?? null); }
    if (parameterColumnFlags.position) { paramCols.push('position'); paramVals.push(`$${paramParams.length+1}`); paramParams.push(1); }
    let newParamId = null;
    try {
      const { rows: createdParam } = await pool.query(`INSERT INTO analysis_parameters(${paramCols.join(',')}) VALUES(${paramVals.join(',')}) RETURNING id`, paramParams);
      newParamId = createdParam[0].id;
    } catch (err) {
      console.warn('[SEED][PACKAGES] No se pudo crear parámetro para %s: %s', paramRow.name, err.message);
    }
    if (newParamId) {
      await cloneRanges(paramRow.id, newParamId);
    }

    analysisByName.set(normalized, newAnalysisId);
    createdAnalyses++;
    return newAnalysisId;
  }

  for (const prof of profiles) {
    await pool.query('BEGIN');
    try {
      const slug = prof.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      let packageId;
      if (packagesHasSlug) {
        const pkgRes = await pool.query(
          `INSERT INTO analysis_packages(name, description, price, slug)
           VALUES($1,$2,NULL,$3)
           ON CONFLICT (slug) DO UPDATE SET description = COALESCE(analysis_packages.description, EXCLUDED.description)
           RETURNING id`,
          [prof.name, prof.description, slug || null]
        );
        packageId = pkgRes.rows[0].id;
      } else {
        const { rows: existing } = await pool.query(
          'SELECT id FROM analysis_packages WHERE LOWER(name)=LOWER($1) LIMIT 1',
          [prof.name]
        );
        if (existing[0]) {
          packageId = existing[0].id;
          if (prof.description) {
            await pool.query(
              'UPDATE analysis_packages SET description = COALESCE(description, $2) WHERE id = $1',
              [packageId, prof.description]
            );
          }
        } else {
          const pkgRes = await pool.query(
            'INSERT INTO analysis_packages(name, description, price) VALUES($1,$2,NULL) RETURNING id',
            [prof.name, prof.description]
          );
          packageId = pkgRes.rows[0].id;
        }
      }
      if (analysisHasPackageId) {
        await pool.query('UPDATE analysis SET package_id=$1 WHERE id=$2', [packageId, prof.id]);
      }

      const { rows: params } = await pool.query(paramsSql, [prof.id]);
      let position = 1;
      let packageHasItems = false;
      for (const param of params) {
        const key = normalizeName(param.name);
        let childAnalysisId = key ? analysisByName.get(key) : null;
        if (!childAnalysisId) {
          childAnalysisId = await ensureStandaloneAnalysis(param, prof);
        }
        if (!childAnalysisId) {
          const label = (param.name || '').trim() || key || '(sin nombre)';
          missingNames.set(label, (missingNames.get(label) || 0) + 1);
          continue;
        }
        packageHasItems = true;
        linkedItems++;
        if (supportsPosition) {
          await pool.query(
            `INSERT INTO analysis_package_items(package_id, item_id, item_type, position)
             VALUES($1,$2,'analysis',$3)
             ON CONFLICT DO NOTHING`,
            [packageId, childAnalysisId, position++]
          );
        } else {
          await pool.query(
            `INSERT INTO analysis_package_items(package_id, item_id, item_type)
             VALUES($1,$2,'analysis')
             ON CONFLICT DO NOTHING`,
            [packageId, childAnalysisId]
          );
        }
      }
      if (packageHasItems) packagesTouched++;
      await pool.query('COMMIT');
      console.log('[SEED][PACKAGES] Perfil %s vinculado a %d estudios.', prof.name, packageHasItems ? position-1 : 0);
    } catch (pkgErr) {
      await pool.query('ROLLBACK');
      console.warn('[SEED][PACKAGES] No se pudo crear paquete para %s: %s', prof.name, pkgErr.message);
    }
  }
  console.log('[SEED][PACKAGES] Resumen: paquetes tocados=%d, ítems vinculados=%d, nuevos análisis=%d, pendientes=%d', packagesTouched, linkedItems, createdAnalyses, missingNames.size);
  if (missingNames.size) {
    const sample = Array.from(missingNames.entries()).slice(0, 10).map(([name, count]) => `${name} (${count})`);
    console.warn('[SEED][PACKAGES] Advertencia: no se pudieron generar/vincular estudios para %s%s', sample.join(', '), missingNames.size > sample.length ? '...' : '');
  }
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

module.exports = { PANELS, seed, bootstrapPackagesFromProfiles };
