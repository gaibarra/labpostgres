const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const JSON5 = require('json5');
const { studySchema } = require('../utils/studySchema');
const { parameterSchema } = require('../utils/parameterSchema');

// AJV instancia (singleton simple)
const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
const validateStudy = ajv.compile(studySchema);
const validateParameter = ajv.compile(parameterSchema);

// === Helpers & Async Job Infra ===
const aiJobs = new Map();
function newJobId(){ return 'job_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }

async function getApiKey(){
  // Intenta leer tanto la clave nueva (openaiApiKey) como el alias legacy (openAIKey) y finalmente env OPENAI_API_KEY
  try {
    const { rows } = await pool.query("SELECT COALESCE(integrations_settings->>'openaiApiKey', integrations_settings->>'openAIKey') AS key FROM lab_configuration ORDER BY created_at ASC LIMIT 1");
    const dbKey = rows[0]?.key?.trim();
    if (dbKey) return dbKey;
  } catch(e){
    if (process.env.AI_DEBUG) console.warn('[AI] Error leyendo configuración para API key', e.message);
  }
  const envKey = (process.env.OPENAI_API_KEY || '').trim();
  if (envKey) {
    if (process.env.AI_DEBUG) console.log('[AI] usando OPENAI_API_KEY de entorno');
    return envKey;
  }
  return null;
}

// Validación ligera de formato (coincide con /api/config/integrations/validate)
function isPlausibleOpenAIKey(key){
  return /^(sk|ds)-[A-Za-z0-9-_]{20,}$/.test(key||'');
}

// Conjuntos canónicos de parámetros para estudios comunes (mejoran completitud)
const CANONICAL_STUDY_PARAMETER_SETS = [
  {
    match: /(biometr(i|í)a|hemograma|bh|biometria) hem(á|a)tica|hemograma completo/i,
    name: 'Biometría Hemática',
    parameters: [
      'Hemoglobina','Hematocrito','Eritrocitos','VCM','HCM','CHCM','RDW','Plaquetas','VMP',
      'Leucocitos Totales','Neutrófilos Segmentados','Neutrófilos Banda','Linfocitos','Monocitos','Eosinófilos','Basófilos',
      'Blastos','Metamielocitos','Mielocitos','Promielocitos','Otros','Notas'
    ]
  },
  {
    match: /(perfil|panel) lip(í|i)dico|lipid(o|ó)grama|perfil de lip(í|i)dos/i,
    name: 'Perfil Lipídico',
    parameters: ['Colesterol Total','HDL','LDL Calculado','Triglicéridos','VLDL','Colesterol No-HDL','Índice Col/HDL']
  },
  {
    match: /(perfil|panel) tiro(í|i)deo|tiroidea|función tiroidea/i,
    name: 'Perfil Tiroideo',
    parameters: ['TSH','T4 Libre','T4 Total','T3 Libre','T3 Total','Anticuerpos Anti-TPO','Anticuerpos Anti-Tiroglobulina']
  },
  {
    match: /(química|quimica) (sangu(í|i)nea|cl(í|i)nica|de ?(12|14|20)|completa)/i,
    name: 'Química Sanguínea',
    parameters: ['Glucosa','Urea','BUN','Creatinina','Ácido Úrico','Colesterol Total','Triglicéridos','AST (TGO)','ALT (TGP)','Fosfatasa Alcalina','Bilirrubina Total','Bilirrubina Directa','Bilirrubina Indirecta','Albúmina','Proteínas Totales','Calcio','Sodio','Potasio','Cloro','Magnesio']
  }
];
  // ================== NUEVO ENDPOINT PARAMETRO IA ==================
  // Genera un único parámetro adicional para un estudio existente
  // Body esperado: { studyName, category, existingParameters: string[], desiredParameterName? }
  router.post('/generate-parameter', requireAuth, requirePermission('studies','create'), async (req,res)=>{
    const { studyName, category, existingParameters, desiredParameterName } = req.body || {};
    if (!studyName || typeof studyName !== 'string') return res.status(400).json({ error:'studyName requerido' });
    const apiKey = await getApiKey();
    if (!apiKey) return res.status(400).json({ error:'OpenAI API key no configurada.', code:'OPENAI_MISSING_KEY' });
    if (!isPlausibleOpenAIKey(apiKey)) {
      return res.status(400).json({ error: 'OPENAI_INVALID_KEY_FORMAT', message: 'Formato de API key inválido o incompleto. Debe iniciar con sk- y no estar truncada.' });
    }
    const safeExisting = Array.isArray(existingParameters) ? existingParameters.filter(p=> typeof p === 'string' && p.trim()) : [];
    // Construir prompt enfocado a UN solo parámetro
    const paramInstruction = desiredParameterName && desiredParameterName.trim() ? `Genera exclusivamente el parámetro adicional denominado "${desiredParameterName.trim()}"` : 'Elige UN parámetro adicional clínicamente relevante y no redundante';
    const prompt = `Eres un profesional de laboratorio clínico. El estudio base es: "${studyName}" (categoría: ${category||'N/D'}). Parámetros ya existentes: ${safeExisting.join(', ')||'NINGUNO'}. ${paramInstruction}. Debes devolver SOLO JSON válido con esta estructura exacta: { name: string, unit: string, decimal_places: number, valorReferencia: [ { sexo: 'Masculino'|'Femenino'|'Ambos', edadMin: number|null, edadMax: number|null, unidadEdad:'años', valorMin: number|null, valorMax: number|null, textoPermitido?: string, textoLibre?: string, notas?: string } ] }.
    Requisitos:
    1. No repetir ni sinónimos de parámetros ya existentes.
    2. Cobertura de edades 0-120 AÑOS completa por sexo aplicable (puede usar segmentos 0-1,2-12,13-17,18-45,46-65,66-120) sin huecos; usar valorMin=null y valorMax=null si no hay datos y notas="Sin referencia establecida".
    3. decimal_places coherente con el tipo de medida.
    4. No añadir texto fuera del JSON.
    5. Si el parámetro solo aplica a un sexo, omite totalmente el otro.
    6. El nombre en español clínico estándar, corto.
    Responde ahora:`;
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
        body: JSON.stringify({
          model:'gpt-4o-mini',
          messages:[ { role:'system', content:'Asistente de laboratorio clínico. Devuelve SOLO JSON.' }, { role:'user', content: prompt } ],
          temperature:0.3,
          max_tokens: 1000,
          response_format:{ type:'json_object' }
        })
      });
      if (!resp.ok){
        let bodyText = await resp.text();
        let parsedErr = null;
        try { parsedErr = JSON.parse(bodyText); } catch(_) {}
        const openaiCode = parsedErr?.error?.code;
        const status = resp.status;
        if (process.env.AI_DEBUG) {
          console.warn('[AI] OpenAI fallo', { status, openaiCode, keyLast4: apiKey.slice(-4), snippet: bodyText.slice(0,120) });
        }
        if (openaiCode === 'invalid_api_key' || status === 401) {
          return res.status(400).json({ error:'OPENAI_INVALID_KEY', message:'La clave OpenAI es inválida o fue revocada. Actualiza la clave en Configuración > Integraciones.', openaiCode, status });
        }
        return res.status(502).json({ error:'Fallo OpenAI', details: bodyText.slice(0,500), status });
      }
      const data = await resp.json();
      let raw = (data?.choices?.[0]?.message?.content||'').trim();
      const clean = raw.replace(/```[a-zA-Z]*\n?/g,'').replace(/```/g,'').trim();
      let parsed;
      const attempts = [];
      attempts.push(clean);
      const first = clean.indexOf('{'); const last = clean.lastIndexOf('}');
      if (first>-1 && last>first) attempts.push(clean.slice(first,last+1));
      for (const att of [...attempts]){
        // quitar comas colgantes
        const noTrailing = att.replace(/,(\s*[}\]])/g,'$1');
        if (noTrailing!==att) attempts.push(noTrailing);
      }
      let salvaged=false, strategy='';
      for (const att of attempts){
        try { parsed = JSON.parse(att); strategy = strategy||'json'; break; } catch(_) {}
      }
      if (!parsed){
        // Fallback JSON5
        try { parsed = JSON5.parse(attempts[0]); salvaged=true; strategy='json5'; } catch(_) {}
      }
      if (!parsed || typeof parsed !== 'object') return res.status(500).json({ error:'JSON inválido', raw: clean.slice(0,800) });
      // Reparaciones mínimas
      if (typeof parsed.decimal_places !== 'number' || parsed.decimal_places<0) parsed.decimal_places=0;
      if (parsed.decimal_places>6) parsed.decimal_places=6;
      if (!Array.isArray(parsed.valorReferencia)) parsed.valorReferencia=[];
      parsed.valorReferencia.forEach(v=>{
        if (!v.unidadEdad) v.unidadEdad='años';
        if (!v.sexo) v.sexo='Ambos';
      });
      const valid = validateParameter(parsed);
      if (!valid){
        return res.status(422).json({ error:'PARAM_SCHEMA_INVALID', schemaErrors: validateParameter.errors.map(e=> (e.instancePath||'/')+' '+e.message).slice(0,20) });
      }
      const fakeStudy = { name: studyName, parameters: [ parsed ] };
      const enriched = ensureCoveragePost(fakeStudy, studyName).parameters[0];
      if (salvaged) enriched.ai_meta = { ...(enriched.ai_meta||{}), salvaged: strategy };
      return res.json({ parameter: enriched });
    } catch(err){
      return res.status(500).json({ error: err.message });
    }
  });

function findCanonicalSet(studyName){
  if (!studyName) return null;
  return CANONICAL_STUDY_PARAMETER_SETS.find(s=> s.match.test(studyName));
}

function buildPrompt(studyName){
  const canonical = findCanonicalSet(studyName);
  const baseIntro = `Eres un asistente experto en laboratorio clínico. Genera un JSON REALISTA, EXHAUSTIVO y CLÍNICAMENTE ÚTIL para el estudio: "${studyName}".`;
  const canonicalBlock = canonical ? `\nEste estudio está reconocido y DEBE incluir exactamente estos parámetros (en este orden) usando estos nombres tal cual, sin omitir ninguno; si no hay datos de referencia válidos para alguno, incluye rangos con valorMin=null, valorMax=null y notas=\"Sin referencia establecida\":\nPARAMETROS_OBLIGATORIOS: ${canonical.parameters.join(', ')}\nNo agregues parámetros extra que no sean clínicamente estándar para este panel.` : '';
  return `${baseIntro}${canonicalBlock}\nRequisitos IMPORTANTES para cada parámetro:\n1. Incluir valores de referencia (valorReferencia) cubriendo toda la vida humana 0-120 años (unidadEdad='años') sin huecos y ordenados. Puedes usar etapas (0-1,2-12,13-17,18-45,46-65,66-120).\n2. Incluir ambos sexos salvo que NO aplique (ej: embarazo solo Femenino, PSA solo Masculino); omite completamente el sexo no aplicable.\n3. decimal_places coherente (enteros: hemogramas celulares; bioquímica según magnitud).\n4. Si un tramo carece de valores consolidados: valorMin=null, valorMax=null, notas=\"Sin referencia establecida\".\n5. Usa nombres de parámetros en español clínico estándar (no traducciones literales raras).\n6. NO incluyas explicaciones fuera del JSON.\n7. Estructura EXACTA: { name, description, indications, sample_type, sample_container, processing_time_hours, category, parameters:[ { name, unit, decimal_places, valorReferencia:[ { sexo, edadMin, edadMax, unidadEdad:'años', valorMin, valorMax, textoPermitido?, textoLibre?, notas? } ] } ] }\n8. Asegúrate que TODOS los parámetros obligatorios estén presentes y con al menos un arreglo valorReferencia (aunque sea con un tramo null).\nResponde SOLO con JSON válido.`;
}

// Utilidad para normalizar acentos básicos
function normalizeKey(s){
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu,'')
    .replace(/\s+/g,' ').trim();
}

function ensureCoveragePost(parsed, studyName){
  parsed.name = parsed.name || studyName;
  parsed.description = parsed.description || '';
  parsed.indications = parsed.indications || parsed.patient_instructions || '';
  parsed.sample_type = parsed.sample_type || '';
  parsed.parameters = Array.isArray(parsed.parameters) ? parsed.parameters : [];
  if (!parsed.category) {
    const lower = studyName.toLowerCase();
    if (/tiroid|tiroideo/.test(lower)) parsed.category = 'Endocrinología';
    else if (/lipid|lipidico|colesterol|triglicerid/.test(lower)) parsed.category = 'Química Clínica';
    else if (/hemato|hemogram|hemograma/.test(lower)) parsed.category = 'Hematología';
    else parsed.category = 'Otros';
  }
  const femaleOnlyPatterns = /embarazo|hcg|\bbeta.?hcg\b|prenatal/i;
  const maleOnlyPatterns = /psa|antígeno prost/i;
  const AGE_SEGMENTS = [ [0,1], [2,12], [13,17], [18,45], [46,65], [66,120] ];
  const PARAM_SYNONYMS = {
    'recuento de globulos rojos':'Eritrocitos',
    'recuento de globulos blancos':'Leucocitos Totales',
    'hematies':'Eritrocitos',
    'eritrocitos':'Eritrocitos',
    'leucocitos':'Leucocitos Totales',
    'plaquetas':'Plaquetas'
  };
  const clamp = (v)=> (v == null ? v : (v < 0 ? 0 : (v > 120 ? 120 : v)));
  function ensureCoverage(param){
    if (!Array.isArray(param.valorReferencia)) { param.valorReferencia = []; }
    const name = param.name || '';
    const femaleOnly = femaleOnlyPatterns.test(name);
    const maleOnly = maleOnlyPatterns.test(name);
    const needMale = !femaleOnly;
    const needFemale = !maleOnly;
    const bySex = { Masculino: [], Femenino: [] };
    // Si no hay datos existentes, generar segmentos nulos estándar para los sexos aplicables
    if (param.valorReferencia.length === 0) {
      if (needMale) {
        for (const [a,b] of AGE_SEGMENTS) bySex.Masculino.push({ sexo:'Masculino', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
      }
      if (needFemale) {
        for (const [a,b] of AGE_SEGMENTS) bySex.Femenino.push({ sexo:'Femenino', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
      }
    } else {
      for (const vr of param.valorReferencia) {
        const sexo = vr.sexo === 'Masculino' || vr.sexo === 'Femenino' ? vr.sexo : (vr.sexo === 'Ambos' ? 'Ambos' : 'Ambos');
        if (sexo === 'Ambos') { bySex.Masculino.push(vr); bySex.Femenino.push(vr); } else { bySex[sexo].push(vr); }
      }
    }
    ['Masculino','Femenino'].forEach(sex=>{
      if ((sex==='Masculino' && !needMale) || (sex==='Femenino' && !needFemale)) return;
      let list = bySex[sex].map(v=>({
        ...v,
        edadMin: clamp(v.edadMin != null ? v.edadMin : v.age_min),
        edadMax: clamp(v.edadMax != null ? v.edadMax : v.age_max)
      })).filter(v=> v.edadMin==null || v.edadMax==null || v.edadMin <= v.edadMax);
      list.sort((a,b)=> (a.edadMin??0) - (b.edadMin??0));
      const normalized = [];
      let cursor = 0;
      for (const seg of list){
        let sMin = seg.edadMin==null? cursor : seg.edadMin;
        let sMax = seg.edadMax==null? seg.edadMax : seg.edadMax;
        if (sMin > cursor) normalized.push({ sexo: sex, edadMin: cursor, edadMax: sMin-1, unidadEdad: 'años', valorMin: null, valorMax: null, notas: 'Sin referencia establecida' });
        normalized.push({ sexo: sex, edadMin: sMin, edadMax: sMax!=null? sMax: sMin, unidadEdad: 'años', valorMin: seg.valorMin??seg.normal_min??seg.lower??null, valorMax: seg.valorMax??seg.normal_max??seg.upper??null, textoPermitido: seg.textoPermitido||'', textoLibre: seg.textoLibre||'', notas: seg.notas||seg.notes||'' });
        cursor = (sMax!=null? sMax : sMin) + 1;
        if (cursor>120) break;
      }
      if (cursor <= 120) normalized.push({ sexo: sex, edadMin: cursor, edadMax: 120, unidadEdad: 'años', valorMin: null, valorMax: null, notas: 'Sin referencia establecida' });
      bySex[sex] = normalized;
    });
    let finalList = [];
    if (needMale) finalList = finalList.concat(bySex.Masculino);
    if (needFemale) finalList = finalList.concat(bySex.Femenino);
    param.valorReferencia = finalList;
  }
  // Normalizar sinónimos antes de agregar canónicos
  const seenNormalized = new Set();
  parsed.parameters.forEach(p => {
    const nk = normalizeKey(p.name);
    if (PARAM_SYNONYMS[nk]) {
      p.name = PARAM_SYNONYMS[nk];
    }
    seenNormalized.add(normalizeKey(p.name));
  });

  // Asegurar inclusión de parámetros canónicos si aplica
  const canonical = findCanonicalSet(studyName);
  if (canonical) {
    for (const pname of canonical.parameters) {
      if (!seenNormalized.has(normalizeKey(pname))) {
        parsed.parameters.push({ name: pname, unit:'', decimal_places: 0, valorReferencia: [] });
      }
    }
  }
  for (const p of parsed.parameters) ensureCoverage(p);
  return { ...parsed, ai_meta: { source: 'openai', model: 'gpt-4o-mini', ts: new Date().toISOString(), coverage: '0-120 ensured' } };
}

async function generateStudyDetails(studyName, progressCb){
  progressCb && progressCb(5,'validando');
  const apiKey = await getApiKey();
  if (!apiKey) throw Object.assign(new Error('OpenAI API key no configurada.'), { code: 'OPENAI_MISSING_KEY' });
  progressCb && progressCb(10,'preparando prompt');
  const prompt = buildPrompt(studyName);
  progressCb && progressCb(25,'llamando a OpenAI');
  if (process.env.AI_DEBUG) console.log('[AI] solicitando a OpenAI modelo gpt-4o-mini para', studyName);
  
  async function callOpenAI(body){
    const resp = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    if (!resp.ok){
      const text = await resp.text();
      throw Object.assign(new Error('Fallo al llamar OpenAI'), { code:'OPENAI_CALL_FAILED', details: text.slice(0,500) });
    }
    return resp.json();
  }

  function cleanContent(raw){
    return (raw||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  }
  // Heurísticas de reparación JSON
  function tryParse(original){
    let content = original;
    const attempts = [];
    const pushAttempt = (label, text) => attempts.push({ label, text });
    pushAttempt('raw', content);
    // Eliminar fences múltiples y texto fuera de llaves
    content = content
      .replace(/```[a-zA-Z]*\n?/g,'')
      .replace(/```/g,'')
      .trim();
    pushAttempt('noFences', content);
    // Recortar a primer '{' y último '}'
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace > 0 || lastBrace < content.length-1){
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace>firstBrace){
        const sliced = content.slice(firstBrace, lastBrace+1).trim();
        pushAttempt('slicedBraces', sliced);
      }
    }
    // Quitar comas colgantes
    const noTrailing = content.replace(/,(\s*[}\]])/g,'$1');
    if (noTrailing !== content) pushAttempt('noTrailingCommas', noTrailing);
    // Balance simple de llaves: si # { > # } añadir '}' al final
    const openCount = (str)=> (str.match(/{/g)||[]).length;
    const closeCount = (str)=> (str.match(/}/g)||[]).length;
    attempts.slice().forEach(a => {
      const o = openCount(a.text); const c = closeCount(a.text);
      if (o>c){ pushAttempt(a.label+'+balanced', a.text + '}'.repeat(o-c)); }
    });
    // Intentos de parseo
    for (const att of attempts){
      try { return { ok:true, value: JSON.parse(att.text), salvaged: att.label !== 'raw', strategy: att.label }; } catch(e) { /* continue */ }
    }
    return { ok:false };
  }
  function validateAndRepair(obj){
    if (!obj || typeof obj !== 'object') return { ok:false, errors:['No es objeto'] };
    // Reparaciones mínimas antes de validar
    // Asegurar campos raíz requeridos si faltan (muchos modelos omiten category)
    if (!obj.category || typeof obj.category !== 'string') obj.category = 'Otros';
    if (!Array.isArray(obj.parameters)) {
      // Si viene como objeto { Param: {...}, Param2: {...} }
      if (obj.parameters && typeof obj.parameters === 'object') {
        obj.parameters = Object.entries(obj.parameters).map(([k,v])=> ({ name:k, ...(typeof v==='object'&&v? v:{} ) }));
      } else {
        obj.parameters = [];
      }
    }
    // Synonyms root level
    if (obj.parametros && !obj.parameters) obj.parameters = obj.parametros;
    if (obj.categoria && !obj.category) obj.category = obj.categoria;
    if (Array.isArray(obj.parameters)) {
      obj.parameters.forEach(p => {
        if (p && typeof p === 'object') {
          // Parameter-level synonyms before enforcing
          if (p.nombre && !p.name) p.name = p.nombre;
          if (p.parametro && !p.name) p.name = p.parametro;
          if (p.unidad && !p.unit) p.unit = p.unidad;
          if (p.decimales != null && p.decimal_places == null) p.decimal_places = p.decimales;
          if (p.decimals != null && p.decimal_places == null) p.decimal_places = p.decimals;
          if (p.decimalPlaces != null && p.decimal_places == null) p.decimal_places = p.decimalPlaces;
          // Reference array synonyms
          if (!p.valorReferencia){
            if (Array.isArray(p.valoresReferencia)) p.valorReferencia = p.valoresReferencia;
            else if (Array.isArray(p.referenceRanges)) p.valorReferencia = p.referenceRanges;
            else if (Array.isArray(p.reference_ranges)) p.valorReferencia = p.reference_ranges;
            else if (Array.isArray(p.rangos)) p.valorReferencia = p.rangos;
          }
          // Normalizar nombre de propiedad alternativa decimalPlaces
            if (p.decimal_places == null && typeof p.decimalPlaces === 'number') p.decimal_places = p.decimalPlaces;
          if (typeof p.decimal_places !== 'number' || p.decimal_places < 0) p.decimal_places = 0;
          if (p.decimal_places > 6) p.decimal_places = 6;
          if (typeof p.unit !== 'string') p.unit = '';
          if (!Array.isArray(p.valorReferencia)) p.valorReferencia = [];
          // Si no hay ningún valorReferencia, crear uno por defecto para Ambos 0-120 (será completado después por ensureCoveragePost)
          if (p.valorReferencia.length === 0) {
            p.valorReferencia.push({ sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
          }
          p.valorReferencia.forEach(vr => {
            if (!vr || typeof vr !== 'object') {
              // Sustituir entradas no objeto por rango vacío completo
              const idx = p.valorReferencia.indexOf(vr);
              p.valorReferencia[idx] = { sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' };
              vr = p.valorReferencia[idx];
            }
            if (vr && typeof vr === 'object') {
              // Sinónimos de campos categóricos
              if (!vr.textoPermitido) {
                if (Array.isArray(vr.valoresPermitidos)) vr.textoPermitido = vr.valoresPermitidos.join(',');
                else if (Array.isArray(vr.allowedValues)) vr.textoPermitido = vr.allowedValues.join(',');
                else if (typeof vr.valoresPermitidos === 'string') vr.textoPermitido = vr.valoresPermitidos;
                else if (typeof vr.allowedValues === 'string') vr.textoPermitido = vr.allowedValues;
              }
              // Field synonyms for ranges
              if (vr.genero && !vr.sexo) vr.sexo = vr.genero === 'M' ? 'Masculino' : vr.genero === 'F' ? 'Femenino' : 'Ambos';
              if (vr.gender && !vr.sexo) vr.sexo = vr.gender === 'male' ? 'Masculino' : vr.gender === 'female' ? 'Femenino' : 'Ambos';
              if (vr.edad_min != null && vr.edadMin == null) vr.edadMin = vr.edad_min;
              if (vr.edad_max != null && vr.edadMax == null) vr.edadMax = vr.edad_max;
              if (vr.age_min != null && vr.edadMin == null) vr.edadMin = vr.age_min;
              if (vr.age_max != null && vr.edadMax == null) vr.edadMax = vr.age_max;
              if (vr.unidad_edad && !vr.unidadEdad) vr.unidadEdad = vr.unidad_edad;
              if (vr.age_unit && !vr.unidadEdad) vr.unidadEdad = vr.age_unit;
              if (vr.minimo != null && vr.valorMin == null) vr.valorMin = vr.minimo;
              if (vr.maximo != null && vr.valorMax == null) vr.valorMax = vr.maximo;
              if (vr.min != null && vr.valorMin == null) vr.valorMin = vr.min;
              if (vr.max != null && vr.valorMax == null) vr.valorMax = vr.max;
              if (vr.lower != null && vr.valorMin == null) vr.valorMin = vr.lower;
              if (vr.upper != null && vr.valorMax == null) vr.valorMax = vr.upper;
              if (vr.notes && !vr.notas) vr.notas = vr.notes;
              if (vr.edadMin != null && vr.edadMin > vr.edadMax && vr.edadMax != null) {
                // swap si vienen invertidos
                const tmp = vr.edadMin; vr.edadMin = vr.edadMax; vr.edadMax = tmp;
              }
              if (!vr.unidadEdad) vr.unidadEdad = 'años';
              if (!vr.sexo) vr.sexo = 'Ambos';
              // Si faltan edades en parámetros categóricos simples (ej ABO / RH) poner rango completo
              if (vr.edadMin == null) vr.edadMin = 0;
              if (vr.edadMax == null) vr.edadMax = 120;
              // Parseo numérico si vienen como string
              if (typeof vr.edadMin === 'string') { const n=parseInt(vr.edadMin,10); if(!isNaN(n)) vr.edadMin=n; }
              if (typeof vr.edadMax === 'string') { const n=parseInt(vr.edadMax,10); if(!isNaN(n)) vr.edadMax=n; }
              if (typeof vr.valorMin === 'string') { const n=parseFloat(vr.valorMin); if(!isNaN(n)) vr.valorMin=n; }
              if (typeof vr.valorMax === 'string') { const n=parseFloat(vr.valorMax); if(!isNaN(n)) vr.valorMax=n; }
            }
          });
          // Si el parámetro es categórico (todos los valorReferencia tienen textoPermitido / textoLibre y sin valores numéricos) mantener decimal_places=0
          const allCategorical = p.valorReferencia.length>0 && p.valorReferencia.every(v=> (v && (v.textoPermitido || v.textoLibre) && (v.valorMin==null && v.valorMax==null)));
          if (allCategorical) p.decimal_places = 0;
        }
      });
    }
    const valid = validateStudy(obj);
    if (valid) return { ok:true, value: obj };
    return { ok:false, errors: validateStudy.errors?.map(e=> `${e.instancePath||'/'} ${e.message}`) || ['Error desconocido'] };
  }

  let attempt = 0; let parsed;
  const maxAttempts = 3; // incrementa a 3 reintentos
  let lastRaw=''; let salvaged = false; let lastStrategy = '';
  while (attempt < maxAttempts){
    attempt++;
    progressCb && progressCb(25 + attempt*5, attempt===1? 'llamando a OpenAI' : 'reintento IA');
    let userContent;
    if (attempt===1) userContent = prompt;
    else if (attempt===2) userContent = prompt + '\nLa respuesta anterior no fue JSON válido. Re-emite SOLO JSON válido. No incluyas comentarios ni explicaciones.';
    else userContent = `CORRIGE y devuelve SOLO JSON válido estrictamente. Si faltaba cerrar llaves o se agregaron descripciones, arréglalo. Mantén estructura solicitada.\nRespuesta previa (recorta si hace falta, pero conserva semántica):\n${lastRaw.slice(0,4000)}`;
    const data = await callOpenAI({
      model:'gpt-4o-mini',
      messages:[
        { role:'system', content: 'Asistente de laboratorio clínico. Devuelve SOLO JSON válido sin texto extra.' },
        { role:'user', content: userContent }
      ],
      temperature:0.25,
      max_tokens: 3200,
      response_format:{ type:'json_object' }
    });
    progressCb && progressCb(50 + attempt*5,'procesando respuesta');
    let content = cleanContent(data?.choices?.[0]?.message?.content);
    lastRaw = content;
    const attemptParse = tryParse(content);
    if (attemptParse.ok){
      parsed = attemptParse.value; salvaged = !!attemptParse.salvaged; lastStrategy = attemptParse.strategy; break;
    }
    // Fallback JSON5 si parsing estricto falla y estamos en último intento
    if (attempt === maxAttempts){
      try {
        const j5 = JSON5.parse(content);
        parsed = j5; salvaged = true; lastStrategy = 'json5'; break;
      } catch(_) {}
    }
  }
  if (!parsed){
    throw Object.assign(new Error('Respuesta IA no es JSON válido tras reintentos'), {
      code:'OPENAI_BAD_JSON',
      raw: lastRaw.slice(0,1200),
      hint: 'Se agotaron heurísticas de reparación. Reintenta o ajusta el nombre del estudio.',
      attempts: maxAttempts
    });
  }
  // Validación de esquema + reparaciones
  const validation = validateAndRepair(parsed);
  if (!validation.ok){
    // Intento de salvamento agresivo: si hay parámetros sin estructura completa, normalizarlos
    const salvageWarnings = [...validation.errors];
    if (parsed && Array.isArray(parsed.parameters)){
      parsed.parameters = parsed.parameters.map(p => {
        if (!p || typeof p !== 'object') return { name: String(p||'Parametro'), unit:'', decimal_places:0, valorReferencia:[{ sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }] };
        const name = p.name || p.nombre || p.parametro || 'Parametro';
        let vr = Array.isArray(p.valorReferencia) ? p.valorReferencia : [];
        if (vr.length===0) vr = [{ sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }];
        return {
          name,
          unit: typeof p.unit === 'string' ? p.unit : (p.unidad || ''),
          decimal_places: typeof p.decimal_places === 'number' ? p.decimal_places : (typeof p.decimales === 'number'? p.decimales:0),
          valorReferencia: vr
        };
      });
    }
    const second = validateAndRepair(parsed);
    if (!second.ok){
      // Fallback mínimo antes de rendirse: crear estudio con parámetros válidos filtrando los que arreglamos
      const minimalParams = Array.isArray(parsed.parameters) ? parsed.parameters.filter(p=> p && p.name).map(p=>({
        name: p.name || 'Parametro',
        unit: typeof p.unit==='string'? p.unit:'',
        decimal_places: typeof p.decimal_places==='number'? Math.max(0, Math.min(6, p.decimal_places)) : 0,
        valorReferencia: Array.isArray(p.valorReferencia) && p.valorReferencia.length>0 ? p.valorReferencia.map(v=>({
          sexo: (v&&v.sexo)||'Ambos',
          edadMin: (v&&typeof v.edadMin==='number')? v.edadMin:0,
          edadMax: (v&&typeof v.edadMax==='number')? v.edadMax:120,
          unidadEdad: 'años',
          valorMin: (v&&typeof v.valorMin==='number')? v.valorMin:null,
          valorMax: (v&&typeof v.valorMax==='number')? v.valorMax:null,
          notas: (v&&v.notas)||'Sin referencia establecida'
        })) : [{ sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }]
      })) : [];
      if (minimalParams.length===0){
        minimalParams.push({ name:'Parametro', unit:'', decimal_places:0, valorReferencia:[{ sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }] });
      }
      parsed = { name: parsed.name || studyName, category: parsed.category || 'Otros', parameters: minimalParams, ai_warnings: salvageWarnings.concat(second.errors).slice(0,50) };
      parsed.ai_meta = { ...(parsed.ai_meta||{}), salvaged: 'minimal-fallback' };
    } else {
      parsed = second.value;
      parsed.ai_warnings = salvageWarnings.slice(0,30);
      parsed.ai_meta = { ...(parsed.ai_meta||{}), salvaged: 'auto-repair-schema' };
    }
  } else {
    parsed = validation.value;
  }
  progressCb && progressCb(75,'normalizando');
  const payload = ensureCoveragePost(parsed, studyName);
  if (salvaged) payload.ai_meta.salvaged = lastStrategy || true;
  progressCb && progressCb(95,'finalizando');
  return payload;
}

// Synchronous endpoint
router.post('/generate-study-details', requireAuth, requirePermission('studies','create'), async (req,res,next)=>{
  try {
    const { studyName } = req.body || {};
    if (!studyName || typeof studyName !== 'string') return res.status(400).json({ error: 'studyName requerido' });
    const result = await generateStudyDetails(studyName);
    res.json(result);
  } catch(err){
    if (err.code === 'OPENAI_MISSING_KEY') return res.status(400).json({ error: err.message, code: err.code });
    if (err.code === 'OPENAI_CALL_FAILED') return res.status(502).json({ error: err.message, code: err.code, details: err.details });
  if (err.code === 'OPENAI_BAD_JSON') return res.status(500).json({ error: err.message, code: err.code, raw: err.raw });
  if (err.code === 'OPENAI_BAD_SCHEMA') return res.status(422).json({ error: err.message, code: err.code, schemaErrors: err.schemaErrors });
    next(err);
  }
});

// Async job creation
router.post('/generate-study-details/async', requireAuth, requirePermission('studies','create'), async (req,res)=>{
  const { studyName } = req.body || {};
  if (!studyName || typeof studyName !== 'string') return res.status(400).json({ error:'studyName requerido' });
  const jobId = newJobId();
  const job = { id: jobId, studyName, status:'queued', progress:0, message:'En cola', createdAt: Date.now() };
  aiJobs.set(jobId, job);
  setImmediate(async ()=>{
    function update(p,msg){ job.progress = p; job.message = msg; job.updatedAt = Date.now(); if (p>=100) job.status='done'; }
    try {
      job.status='working'; job.message='Iniciando';
      const result = await generateStudyDetails(studyName,(p,m)=>{ job.status='working'; update(p,m); });
      update(100,'Completado');
      job.result = result;
    } catch(e){
      job.status='error';
  job.error = { message: e.message, code: e.code, details: e.details, raw: e.raw, schemaErrors: e.schemaErrors };
      job.message = 'Error';
      job.progress = job.progress || 0;
    }
  });
  res.json({ jobId });
});

// Poll job
router.get('/generate-study-details/job/:id', requireAuth, requirePermission('studies','create'), (req,res)=>{
  const { id } = req.params;
  const job = aiJobs.get(id);
  if (!job) return res.status(404).json({ error:'job no encontrado' });
  res.json({ id: job.id, status: job.status, progress: job.progress, message: job.message, result: job.status==='done'? job.result: undefined, error: job.status==='error'? job.error: undefined });
});

module.exports = router;
