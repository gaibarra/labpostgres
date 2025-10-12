// ai.js - Endpoints AI (study + single parameter) con enriquecimiento de rangos
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
// (Schemas externalizados)
const { validateStudy, validateParameter } = require('../validation/ai-schemas');
const JSON5 = require('json5');
const crypto = require('crypto');

// --- Infraestructura de jobs en memoria ---
const aiJobs = new Map();
function newJobId(){ return 'job_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }

// In-memory short cache for recommendations (60s TTL) to reduce token usage
const recCache = new Map(); // key -> { ts, data }
const REC_TTL_MS = 60 * 1000;
function getCache(key){
  const v = recCache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > REC_TTL_MS) { recCache.delete(key); return null; }
  return v.data;
}
function setCache(key, data){
  recCache.set(key, { ts: Date.now(), data });
  // opportunistic cleanup
  if (recCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of recCache.entries()) { if (now - v.ts > REC_TTL_MS) recCache.delete(k); }
  }
}

// --- API Key helper: primero DB (lab_configuration.integrations_settings), luego variable de entorno ---
async function getApiKey(){
  // Intentar cache simple en memoria para evitar query por cada poll
  if (!getApiKey._cache || (Date.now() - getApiKey._cache.ts > 5*60*1000)) { // refresh cada 5 min
    let key = null; let source = 'none';
    try {
      // Carga perezosa de pool para evitar dependencias circulares en tests
      const { pool } = require('../db');
      const { rows } = await pool.query("SELECT COALESCE(integrations_settings->>'openaiApiKey', integrations_settings->>'openAIKey') AS key FROM lab_configuration ORDER BY created_at ASC LIMIT 1");
      key = rows[0]?.key?.trim() || null;
      if (key) source = 'db';
    } catch(e){ /* ignore db errors */ }
    if (!key && process.env.OPENAI_API_KEY) { key = process.env.OPENAI_API_KEY.trim(); if (key) source = 'env'; }
    getApiKey._cache = { value: key || null, source, ts: Date.now() };
    if (process.env.AI_DEBUG) {
      const masked = key ? (key.length>10 ? key.slice(0,4)+'***'+key.slice(-4) : '***') : 'null';
      console.log('[AI][getApiKey] fuente=', source, 'keyPresent=', !!key, 'preview=', masked);
    }
  }
  return getApiKey._cache.value;
}

// --- Prompt para generación de estudio ---
function buildPrompt(studyName){
  return [
    'Actúa como bioquímico clínico senior. Genera ÚNICAMENTE JSON válido.',
  'Esquema: { "name": string (igual o refinado del estudio), "category": string, "description": string, "indications": string, "sample_type": string, "sample_container": string, "processing_time_hours": number|null, "parameters": [ { "name": string, "unit": string, "decimal_places": number, "valorReferencia": [ { "sexo": "Ambos|Masculino|Femenino", "edadMin": number, "edadMax": number, "unidadEdad": "años", "valorMin": number|null, "valorMax": number|null, "notas": string } ] } ] }',
    'Reglas:',
    '- Cubrir 0-120 años (segmentos libres).',
  '- Para cada parámetro debes cubrir EXACTAMENTE estos segmentos de edad: [0-1],[1-2],[2-12],[12-18],[18-65],[65-120].',
  '- Si el parámetro es dependiente de sexo (hemoglobina, hematocrito, eritrocitos, hormonas sexuales, etc.) usa sexo diferenciado a partir de 12 años; pediátrico (0-12) puede ser Ambros/Ambos según corresponda.',
  '- Evita crear segmentos solapados o huecos; cada edad 0<=x<120 cae en un único segmento.',
  '- Si se desconoce un valor usar null y nota "Sin referencia establecida" (pero para parámetros hematológicos clave NO dejes null: hemoglobina, hematocrito, eritrocitos, plaquetas deben tener valores numéricos).',
    '- Evita diagnósticos definitivos o texto fuera del JSON.',
    '- Mantén description concisa (<= 300 chars) sin HTML. indications: preparación paciente/resumen preanalítico (<= 250 chars).',
  '- category: área o familia (ej: HORMONAS, HEMATOLOGIA, BIOQUIMICA, INMUNOLOGIA). Usa mayúsculas y no más de 25 caracteres.',
  '- sample_type: tipo de muestra (ej: Suero, Plasma, Sangre total, Orina). sample_container: tubo o contenedor recomendado. processing_time_hours: número aproximado (ej 24) o null si no aplica.',
    `Estudio: "${studyName}"`,
    'Salida: SOLO JSON.'
  ].join('\n');
}

// (Schemas validados vía módulo importado)

// --- Enriquecimiento y cobertura de rangos ---
function ensureCoverage(parsed, studyName){
  const SEG = [ [0,1],[1,2],[2,12],[12,18],[18,65],[65,120] ];
  if (!parsed || typeof parsed !== 'object') return { parameters:[], ai_meta:{ source:'invalid', ts:new Date().toISOString() } };
  if (!Array.isArray(parsed.parameters)) parsed.parameters=[];
  parsed.parameters = parsed.parameters.filter(p=> p && p.name);

  const { buildParameterTemplate } = require('../utils/referenceTemplates');
  const appliedTemplates = [];

  parsed.parameters.forEach(p=>{
    if (!Array.isArray(p.valorReferencia)) p.valorReferencia=[];
    const original = p.valorReferencia.slice();
    const cleaned=[]; const seen=new Set();
    original.forEach(r=>{
      if (!r||typeof r!=='object') return;
      const sexo = ['Masculino','Femenino'].includes(r.sexo)? r.sexo : 'Ambos';
      const a = r.edadMin ?? 0; const b = r.edadMax ?? 120;
      const k=`${sexo}|${a}|${b}`;
      if (!seen.has(k)){
        seen.add(k);
        cleaned.push({ sexo, edadMin:a, edadMax:b, unidadEdad:'años', valorMin: r.valorMin??null, valorMax: r.valorMax??null, notas: r.notas || (r.valorMin==null && r.valorMax==null ? 'Sin referencia establecida':'') });
      }
    });
    const rawName = (p.name||'').trim();
    const norm = rawName.toLowerCase();
    const originalGeneric = cleaned.length<=2 || cleaned.every(r=> r.valorMin==null && r.valorMax==null);
    const RR = (sexo, aMin, aMax, vMin, vMax, notas='')=>({ sexo, edadMin:aMin, edadMax:aMax, unidadEdad:'años', valorMin:vMin, valorMax:vMax, notas: notas || (vMin==null&&vMax==null?'Sin referencia establecida':'') });

    let overridden = false;

    // 1) Intento de plantilla canónica SI el nombre coincide (aplica incluso si no es generic, para garantizar segmentación)
    const template = buildParameterTemplate(norm);
    if (template) {
      overridden = true;
      if (!p.unit) p.unit = template.unit;
      if (typeof p.decimal_places !== 'number') p.decimal_places = template.decimal_places;
      p.valorReferencia = template.valorReferencia.map(r=>({ ...r }));
      appliedTemplates.push(rawName);
    }
    // Simplificamos estructura para evitar falsos positivos de parsers TS (usamos switch(true))
    if (originalGeneric) {
      switch (true) {
        case /(\b|^)prolactina\b/.test(norm):
          overridden = true;
          p.unit = p.unit || 'ng/mL'; p.decimal_places = 0;
          p.valorReferencia = [
            RR('Femenino',0,1,0,15),
            RR('Femenino',1,2,0,15),
            RR('Femenino',2,12,0,10),
            RR('Femenino',12,13,5,25),
            RR('Femenino',13,17,5,25),
            RR('Femenino',17,18,5,30),
            RR('Femenino',18,45,5,30),
            RR('Femenino',45,55,5,25),
            RR('Femenino',55,120,5,20)
          ];
          break;
        case /progesterona/.test(norm):
          overridden = true;
          p.unit = p.unit || 'ng/mL'; p.decimal_places = 1;
          p.valorReferencia = [
            RR('Femenino',0,1,0,0.5),
            RR('Femenino',1,2,0,0.5),
            RR('Femenino',2,12,0,0.5),
            RR('Femenino',12,13,0.1,5),
            RR('Femenino',13,17,0.1,5),
            RR('Femenino',17,18,0.2,20),
            RR('Femenino',18,45,0.2,20),
            RR('Femenino',45,55,0.1,10),
            RR('Femenino',55,120,0,5)
          ];
          break;
        case /\btsh\b/.test(norm):
          overridden = true;
          p.unit = p.unit || 'µUI/mL'; p.decimal_places = 1;
          p.valorReferencia = [
            RR('Ambos',0,1,0.7,11),
            RR('Ambos',1,2,0.7,8),
            RR('Ambos',2,12,0.7,6),
            RR('Ambos',12,18,0.5,4.5),
            RR('Ambos',18,65,0.4,4),
            RR('Ambos',65,120,0.4,6)
          ];
          break;
        case /t4\s*libre|tiroxina\s*libre/.test(norm):
          overridden = true;
          p.unit = p.unit || 'ng/dL'; p.decimal_places = 1;
          p.valorReferencia = [
            RR('Ambos',0,1,1,2.5),
            RR('Ambos',1,2,0.9,2.4),
            RR('Ambos',2,12,0.9,2.3),
            RR('Ambos',12,18,0.8,2.1),
            RR('Ambos',18,65,0.8,1.8),
            RR('Ambos',65,120,0.7,1.9)
          ];
          break;
        case /t3\s*libre|triyodotironina\s*libre/.test(norm):
          overridden = true;
          p.unit = p.unit || 'pg/mL'; p.decimal_places = 2;
          p.valorReferencia = [
            RR('Ambos',0,1,2.5,6),
            RR('Ambos',1,2,2.4,5.8),
            RR('Ambos',2,12,2.3,5.5),
            RR('Ambos',12,18,2.3,5),
            RR('Ambos',18,65,2.2,4.4),
            RR('Ambos',65,120,2.0,4.6)
          ];
          break;
        case /anti.*peroxidasa|antiperoxidasa|tpo/.test(norm):
          overridden = true;
          p.unit = p.unit || 'UI/mL'; p.decimal_places = 0;
          p.valorReferencia = SEG.map(([a,b])=> RR('Ambos',a,b,0,35));
          break;
        case /anti.*tiroglobulina|antitiroglobulina|anti.*tg\b/.test(norm):
          overridden = true;
          p.unit = p.unit || 'UI/mL'; p.decimal_places = 0;
          p.valorReferencia = SEG.map(([a,b])=> RR('Ambos',a,b,0,4));
          break;
        default:
          // no override
          break;
      }
    }

    if (!overridden) {
      // Rellenar segmentos faltantes manteniendo existentes
      const acc = cleaned.slice();
      const existing = new Set(acc.map(x=>`${x.edadMin}|${x.edadMax}`));
      for (const [a,b] of SEG){
        if (!existing.has(`${a}|${b}`)) acc.push(RR('Ambos',a,b,null,null));
      }
      acc.sort((x,y)=> x.edadMin - y.edadMin || x.sexo.localeCompare(y.sexo));
      p.valorReferencia = acc;
    }

    if (typeof p.decimal_places !== 'number' || p.decimal_places<0) p.decimal_places=0;
    if (p.decimal_places>6) p.decimal_places=6;
    if (typeof p.unit !== 'string') p.unit='';
  });

  const meta = { source:'openai', model:'gpt-4o-mini', study:studyName, ts:new Date().toISOString() };
  if (appliedTemplates.length) meta.overrides = { templates: appliedTemplates };
  return { ...parsed, ai_meta: meta };
}

async function generateStudyDetails(studyName){
  const key = await getApiKey();
  if (!key) throw Object.assign(new Error('OpenAI API key no configurada.'), { code:'OPENAI_MISSING_KEY' });
  const prompt = buildPrompt(studyName);
  async function call(body){
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${key}` },
      body: JSON.stringify(body)
    });
    if (!r.ok){ const txt = await r.text(); throw Object.assign(new Error('Fallo OpenAI'), { code:'OPENAI_CALL_FAILED', details: txt.slice(0,400) }); }
    return r.json();
  }
  let raw=''; let parsed=null;
  for (let attempt=0; attempt<3 && !parsed; attempt++){
    const userContent = attempt===0? prompt : 'Repite SOLO JSON válido. Intento previo inválido';
    const data = await call({ model:'gpt-4o-mini', messages:[ { role:'system', content:'Asistente de laboratorio clínico. Solo JSON.' }, { role:'user', content:userContent } ], temperature:0.25, max_tokens:2500, response_format:{ type:'json_object' } });
  const firstChoice = data && data.choices && Array.isArray(data.choices) && data.choices.length>0 ? data.choices[0] : null;
  const msgContent = firstChoice && firstChoice.message ? firstChoice.message.content : '';
  raw = (msgContent||'').replace(/```[a-zA-Z]*\n?/g,'').replace(/```/g,'').trim();
  try { parsed = JSON.parse(raw); } catch(e){ try { parsed = JSON5.parse(raw); } catch(_e){ /* intento json5 falló */ } }
  }
  if (!parsed) throw Object.assign(new Error('OPENAI_BAD_JSON'), { code:'OPENAI_BAD_JSON', raw: raw.slice(0,400) });
  if (!Array.isArray(parsed.parameters)) parsed.parameters=[];
  const valid = validateStudy(parsed);
  if (!valid) parsed.parameters = parsed.parameters.filter(p=> p && p.name);
  return ensureCoverage(parsed, studyName);
}

router.post('/generate-study-details', requireAuth, requirePermission('studies','create'), async (req,res,next)=>{
  try {
    const { studyName } = req.body || {};
    if (!studyName || typeof studyName !== 'string') return res.status(400).json({ error:'studyName requerido' });
    const result = await generateStudyDetails(studyName);
    res.json(result);
  } catch(err){
    if (err.code === 'OPENAI_MISSING_KEY') return res.status(400).json({ error: err.message, code: err.code });
    if (err.code === 'OPENAI_CALL_FAILED') return res.status(502).json({ error: err.message, code: err.code, details: err.details });
    if (err.code === 'OPENAI_BAD_JSON') return res.status(500).json({ error: err.message, code: err.code, raw: err.raw });
    next(err);
  }
});

router.post('/generate-study-details/async', requireAuth, requirePermission('studies','create'), async (req,res)=>{
  const { studyName } = req.body || {};
  if (!studyName || typeof studyName !== 'string') return res.status(400).json({ error:'studyName requerido' });
  const jobId = newJobId();
  const job = { id:jobId, type:'study-details', status:'queued', progress:0, message:'En cola', createdAt:Date.now() };
  aiJobs.set(jobId, job);
  setImmediate(async ()=>{
    function update(p,m){ job.progress=p; job.message=m; job.updatedAt=Date.now(); if (p>=100) job.status='done'; }
    try { job.status='working'; update(10,'generando'); const resu = await generateStudyDetails(studyName); job.result=resu; update(100,'Completado'); }
    catch(e){ job.status='error'; job.error={ message:e.message, code:e.code, details:e.details }; }
  });
  res.json({ jobId });
});

// ===== REAL RECOMMENDATIONS ENDPOINT =====
function buildRecommendationsPrompt(patientInfo, results){
  return [
    'Actúa como bioquímico clínico. Proporciona análisis y sugerencias educativas SIN diagnosticar ni indicar tratamientos definitivos.',
    'Devuelve SOLO JSON con forma:',
    '{ "summary": string, "outOfRangeRecommendations": [ { "parameterName": string, "result": string|number, "status": string, "explanation": string, "recommendations": [string] } ], "inRangeComments": [ { "parameterName": string, "comment": string } ], "finalDisclaimer": string }',
    'Reglas:',
    '- status puede ser bajo|alto|normal|invalido-alfanumerico|no-evaluable.',
    '- Explicaciones concisas (<180 chars).',
    '- recommendations: máximo 3 bullets accionables de seguimiento o correlación clínica, no prescribir fármacos.',
    '- finalDisclaimer menciona que no reemplaza juicio clínico.',
    `Paciente: edad=${patientInfo.age ?? 'NA'} sexo=${patientInfo.sex||'NA'}`,
    'Resultados (JSON):', JSON.stringify(results).slice(0,4000)
  ].join('\n');
}

async function callChatJson(model, key, prompt){
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages:[ { role:'system', content:'Asistente de laboratorio clínico. Sólo JSON válido.'}, { role:'user', content: prompt } ],
      temperature:0.3,
      response_format:{ type:'json_object' },
      max_tokens:1200
    })
  });
  if (!r.ok){ const txt = await r.text(); throw Object.assign(new Error('AI_API_FAIL'), { code:'AI_API_FAIL', details: txt.slice(0,400) }); }
  const data = await r.json();
  const msg = data?.choices?.[0]?.message?.content?.trim() || '{}';
  let parsed=null; try { parsed = JSON.parse(msg); } catch(e){ try { parsed=JSON5.parse(msg); } catch(_){} }
  if (!parsed || typeof parsed!=='object') throw Object.assign(new Error('AI_BAD_JSON'), { code:'AI_BAD_JSON', raw: msg.slice(0,400) });
  return parsed;
}

router.post('/recommendations', requireAuth, requirePermission('orders','enter_results'), async (req,res,next)=>{
  const t0 = Date.now();
  try {
    const { patientInfo, results } = req.body || {};
    if (!Array.isArray(results) || results.length===0) return res.status(400).json({ error:'SIN_RESULTADOS_VALIDOS' });
    const key = await getApiKey();
    if (!key) return res.status(400).json({ error:'API_KEY_FALTANTE', code:'NO_KEY' });
    // Sanitizar resultados (limitar tamaño, remover PHI)
    const safeResults = results.slice(0,100).map(r=>({
      parameterName: String(r.parameterName||'').slice(0,60),
      result: String(r.result ?? '' ).slice(0,40),
      unit: r.unit ? String(r.unit).slice(0,15) : '',
      refRange: r.refRange ? String(r.refRange).slice(0,80) : '',
      status: String(r.status||'').slice(0,25)
    }));
    // Canonicalize order for stable hash
    safeResults.sort((a,b)=> a.parameterName.localeCompare(b.parameterName));
    const safePatient = { age: Number.isFinite(patientInfo?.age) ? patientInfo.age : null, sex: patientInfo?.sex || null };
    const model = process.env.AI_RECOMMENDATIONS_MODEL || 'gpt-4o-mini';
    const cacheKey = crypto.createHash('sha256').update(JSON.stringify({ model, safePatient, safeResults })).digest('hex');
    const cached = getCache(cacheKey);
    if (cached) {
      const latency = Date.now()-t0;
      if (process.env.AI_DEBUG) console.log('[AI][recs][CACHE_HIT]', { key: cacheKey.slice(0,8), latencyMs: latency });
      return res.json({ ...cached, cached: true });
    }
    const prompt = buildRecommendationsPrompt(patientInfo||{}, safeResults);
    const raw = await callChatJson(model, key, prompt);
    // Normalizar estructura
    const out = {
      summary: String(raw.summary||'Resumen no disponible').slice(0,600),
      outOfRangeRecommendations: Array.isArray(raw.outOfRangeRecommendations) ? raw.outOfRangeRecommendations.slice(0,25).map(o=>({
        parameterName: String(o.parameterName||'').slice(0,60),
        result: String(o.result ?? '').slice(0,40),
        status: String(o.status||'').slice(0,25),
        explanation: String(o.explanation||'').slice(0,200),
        recommendations: Array.isArray(o.recommendations)? o.recommendations.slice(0,3).map(r=>String(r).slice(0,120)) : []
      })) : [],
      inRangeComments: Array.isArray(raw.inRangeComments)? raw.inRangeComments.slice(0,40).map(c=>({
        parameterName: String(c.parameterName||'').slice(0,60),
        comment: String(c.comment||'').slice(0,200)
      })) : [],
      finalDisclaimer: String(raw.finalDisclaimer || 'La información no sustituye la valoración clínica profesional.').slice(0,300),
      model,
      generatedAt: new Date().toISOString(),
      token: crypto.randomUUID()
    };
    setCache(cacheKey, out);
    const latency = Date.now()-t0;
    if (process.env.AI_DEBUG) console.log('[AI][recs]', { count: safeResults.length, latencyMs: latency });
    res.json(out);
  } catch(e){
    if (process.env.AI_DEBUG) console.error('[AI][recs][ERR]', e.code || e.message, e.details || e.raw || '');
    if (e.code === 'AI_API_FAIL') return res.status(502).json({ error:e.code, details:e.details });
    if (e.code === 'AI_BAD_JSON') return res.status(500).json({ error:e.code, raw:e.raw });
    next(e);
  }
});

// === Endpoint de parámetro individual (usa OpenAI si hay API key válida; fallback stub) ===
router.post('/generate-parameter/async', requireAuth, requirePermission('studies','create'), async (req,res)=>{
  const { studyName, desiredParameterName, prompt } = req.body || {};
  if (!studyName || typeof studyName !== 'string') return res.status(400).json({ error:'studyName requerido' });
  if (!desiredParameterName || typeof desiredParameterName !== 'string') return res.status(400).json({ error:'desiredParameterName requerido' });
  const jobId = newJobId();
  const job = { id:jobId, type:'single-parameter', status:'queued', progress:0, message:'En cola', createdAt:Date.now() };
  aiJobs.set(jobId, job);

  setImmediate(async ()=>{
    function update(p,m){ job.progress=p; job.message=m; job.updatedAt=Date.now(); if (p>=100) job.status='done'; }
    function buildSingleParameterPrompt(){
      // Prompt enriquecido basado en reglas históricas del diálogo frontend
      const reglas = [
        'Actúa como bioquímico clínico senior especializado en diseño de parámetros de laboratorio.',
        `Contexto estudio: "${studyName}". Parámetro a generar (referencia usuario): "${desiredParameterName}".`,
        'Objetivo: Proponer UN único parámetro nuevo que complemente el estudio SIN duplicar existentes.',
        'Salida: SOLO JSON válido, sin explicación, siguiendo estrictamente el esquema indicado.',
        'Esquema JSON: { "parameter": { "name": string, "unit": string, "decimal_places": number (0-3), "reference_ranges": [ { "sex": "Ambos|Masculino|Femenino", "age_min": number|null, "age_max": number|null, "age_min_unit": "años", "lower": number|null, "upper": number|null, "text_value": string|null, "notes": string } ] } }',
        'Reglas de rangos: cubrir 0-120 años mediante uno o varios segmentos. Si un intervalo carece de valores establecidos deja lower y upper en null y notes="Sin referencia establecida".',
        'Evita: afirmaciones diagnósticas definitivas, claims regulatorios, texto fuera del JSON, parámetros redundantes.',
        'Si no estás seguro de valores numéricos, utiliza null y la nota estándar.',
        'No inventes unidades exóticas; usa unidades clínicas comunes (mg/dL, g/dL, UI/L, %, etc.) o cadena vacía si no aplica.',
        'Mantén el nombre conciso (< 80 caracteres) y no copies literalmente la descripción del estudio salvo que sea apropiado.',
        'NO incluyas campos adicionales, comentarios, ni markdown.'
      ];
      return reglas.join('\n');
    }
    function buildStub(){
      // Stub enriquecido: genera rangos diferenciados por edad y, en ciertos parámetros, por sexo, con valores aproximados plausibles.
      const nameLc = desiredParameterName.toLowerCase();
      // Detección de tipo
      const lipid = /(colesterol|hdl|ldl|triglic|lipid)/.test(nameLc);
      const glucose = /(gluco|glucosa|azucar)/.test(nameLc);
      const hemo = /(hemoglob|hematocrito|hb)/.test(nameLc);
      const ph = /\bph\b/.test(nameLc);
      const pediIndic = /neo|pedi|infant|lact|niñ|child/.test(nameLc);

      let unit='';
      if (lipid) unit='mg/dL';
      else if (glucose) unit='mg/dL';
      else if (hemo) unit='g/dL';
      else if (ph) unit='';
      const decimal_places = ph?2:0;

      // Helper para crear rango
      const R = (sex, aMin, aMax, low, high, note='')=>({ sex, age_min:aMin, age_max:aMax, age_min_unit:'años', lower:low, upper:high, text_value:null, notes: note || (low==null&&high==null?'Sin referencia establecida':'') });

      let reference_ranges = [];
      if (lipid) {
        // Ejemplo: Colesterol Total u otro; estimaciones sencillas.
        // Diferenciamos adulto y pediátrico, y opcionalmente sexos adultos.
        reference_ranges = [
          R('Ambos',0,1,90,170),
          R('Ambos',1,9,120,190),
          R('Ambos',9,18,130,200),
          R('Masculino',18,120,140,210),
          R('Femenino',18,120,140,200)
        ];
        // HDL heurístico
        if (/hdl/.test(nameLc)) {
          reference_ranges = [
            R('Ambos',0,18,40,80),
            R('Masculino',18,120,40,70),
            R('Femenino',18,120,50,80)
          ];
        }
        if (/ldl/.test(nameLc)) {
          reference_ranges = [
            R('Ambos',0,18,60,120),
            R('Masculino',18,120,70,130),
            R('Femenino',18,120,70,120)
          ];
        }
        if (/triglic/.test(nameLc)) {
          reference_ranges = [
            R('Ambos',0,9,40,100),
            R('Ambos',9,18,50,130),
            R('Ambos',18,120,50,150)
          ];
        }
      } else if (glucose) {
        reference_ranges = [
          R('Ambos',0,1,60,105),
          R('Ambos',1,12,70,110),
          R('Ambos',12,18,70,105),
          R('Ambos',18,120,70,100)
        ];
      } else if (hemo) {
        reference_ranges = [
          R('Ambos',0,1,11,15),
          R('Ambos',1,5,11.5,15.5),
          R('Ambos',5,12,12,16),
          R('Masculino',12,18,13,17),
          R('Femenino',12,18,12,16),
          R('Masculino',18,120,13.5,17.5),
          R('Femenino',18,120,12,16)
        ];
      } else if (ph) {
        reference_ranges = [R('Ambos',0,120,7.35,7.45)];
      } else {
        // Genérico: segmentación pediátrica opcional
        if (pediIndic) {
          reference_ranges = [
            R('Ambos',0,1,null,null),
            R('Ambos',1,2,null,null),
            R('Ambos',2,12,null,null),
            R('Ambos',12,18,null,null),
            R('Ambos',18,65,null,null),
            R('Ambos',65,120,null,null)
          ];
        } else {
            reference_ranges = [R('Ambos',0,120,null,null)];
        }
      }
      return { parameter: { name: desiredParameterName, unit, decimal_places, reference_ranges, notes: 'Stub IA (fallback, enriquecido). Prompt recibido: '+(prompt? 'sí':'no') } };
    }
    try {
      job.status='working'; update(5,'Inicializando');
      const apiKey = await getApiKey();
      const testEnv = process.env.NODE_ENV === 'test';
      const forceStub = !apiKey || process.env.AI_PARAM_FORCE_STUB === '1' || (testEnv && process.env.AI_PARAM_ALLOW_OPENAI !== '1');
      if (forceStub){
        // Reutiliza lógica stub
        update(15,'Modo stub');
        update(60,'Generando parámetro (stub)');
        job.result = buildStub();
        update(100,'Completado');
        return;
      }

      update(12,'Preparando prompt');
      const systemMsg = 'Asistente de laboratorio clínico. Responde únicamente con JSON válido conforme al esquema indicado.';
      const userPrompt = prompt || buildSingleParameterPrompt();
      update(20,'Llamando OpenAI');
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
        body: JSON.stringify({
          model:'gpt-4o-mini',
            messages:[ { role:'system', content: systemMsg }, { role:'user', content: userPrompt } ],
            temperature:0.3,
            max_tokens: 1200,
            response_format:{ type:'json_object' }
        })
      });
      if (!r.ok){
        const txt = await r.text();
        throw Object.assign(new Error('Fallo OpenAI'), { code:'OPENAI_CALL_FAILED', details: txt.slice(0,400) });
      }
      update(40,'Procesando respuesta');
      const data = await r.json();
  const firstChoice2 = data && data.choices && Array.isArray(data.choices) && data.choices.length>0 ? data.choices[0] : null;
  let raw = (firstChoice2 && firstChoice2.message ? firstChoice2.message.content : '').replace(/```[a-zA-Z]*\n?/g,'').replace(/```/g,'').trim();
      // Heurísticos simples de extracción
      const attempts = [raw];
      const first = raw.indexOf('{'); const last = raw.lastIndexOf('}');
      if (first>-1 && last>first) attempts.push(raw.slice(first,last+1));
      let parsed=null; let salvaged=false; let strategy='raw';
      for (const att of attempts){
        try { parsed = JSON.parse(att); strategy = att===raw?'raw':'slice'; break; }
        catch(_){ /* intento fallido parse json */ }
      }
      if (!parsed){
        try { parsed = require('json5').parse(raw); salvaged=true; strategy='json5'; }
        catch(_){ /* intento json5 fallido */ }
      }
      if (!parsed || typeof parsed !== 'object') throw Object.assign(new Error('OPENAI_BAD_JSON'), { code:'OPENAI_BAD_JSON', raw: raw.slice(0,400) });
      // El modelo puede devolver envuelto { parameter: {...} } o directamente el objeto
      let param = parsed.parameter || parsed;
      // Normalizaciones mínimas para pasar schema backend (valorReferencia esperado)
      if (!Array.isArray(param.valorReferencia)) {
        const rr = param.reference_ranges || param.referenceRanges || param.rangos || param.valor_referencia;
        if (Array.isArray(rr)) {
          param.valorReferencia = rr.map(rg=>({
            sexo: rg.sexo || rg.sex || 'Ambos',
            edadMin: rg.edadMin ?? rg.age_min ?? rg.edad_min ?? 0,
            edadMax: rg.edadMax ?? rg.age_max ?? rg.edad_max ?? 120,
            unidadEdad: rg.unidadEdad || rg.age_unit || 'años',
            valorMin: rg.valorMin ?? rg.lower ?? null,
            valorMax: rg.valorMax ?? rg.upper ?? null,
            notas: rg.notas || rg.notes || (rg.lower==null && rg.upper==null ? 'Sin referencia establecida':''),
            textoPermitido: rg.textoPermitido || null,
            textoLibre: rg.textoLibre || rg.text_value || null
          }));
        } else {
          // fallback a un rango completo
          param.valorReferencia = [{ sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }];
        }
      }
      if (typeof param.decimal_places !== 'number' || param.decimal_places<0) param.decimal_places=0;
      if (param.decimal_places>6) param.decimal_places=6;
      if (typeof param.unit !== 'string') param.unit = '';
      // Validación liviana: requiere name
      if (!param.name) param.name = desiredParameterName;
      update(65,'Normalizando rangos');
      // Asegurar cobertura simple 0-120 (no creamos huecos aquí para evitar sobre-construcción)
      const spanExists = new Set(param.valorReferencia.map(r=> `${r.edadMin}|${r.edadMax}|${r.sexo}`));
      if (!Array.from(spanExists).some(k=> k.startsWith('0|120'))){
        param.valorReferencia.push({ sexo:'Ambos', edadMin:0, edadMax:120, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
      }
      // Aplicar overrides/homogeneización usando ensureCoverage (reutilizando la lógica de estudio)
      const enriched = ensureCoverage({ parameters:[param] }, studyName || 'single');
      param = enriched.parameters[0];

      // Validación final de schema parámetro
      if (!validateParameter(param)){
        if (process.env.AI_DEBUG) console.warn('[AI][single-parameter] schema inválido, fallback stub', validateParameter.errors);
        throw Object.assign(new Error('PARAM_SCHEMA_INVALID'), { code:'PARAM_SCHEMA_INVALID', details: JSON.stringify(validateParameter.errors?.slice(0,3)) });
      }
      update(75,'Formateando salida');
      // Convertimos a shape frontend (reference_ranges)
      const reference_ranges = param.valorReferencia.map(v=>({
        sex: v.sexo,
        age_min: v.edadMin,
        age_max: v.edadMax,
        age_min_unit: v.unidadEdad,
        lower: v.valorMin,
        upper: v.valorMax,
        text_value: v.textoLibre || v.textoPermitido || null,
        notes: v.notas || ''
      }));
      job.result = { parameter: { name: param.name, unit: param.unit, decimal_places: param.decimal_places, reference_ranges, notes: 'Generado con OpenAI'+(salvaged?` (salvaged:${strategy})`:'') } };
      update(100,'Completado');
    } catch(e){
      // Fallback automático a stub salvo que exista flag que fuerce error estricto
      const strict = process.env.AI_PARAM_STRICT_ERROR === '1';
      if (!strict){
        update(80,'Fallback stub tras error');
        job.result = buildStub();
        update(100,'Completado (fallback)');
      } else {
        job.status='error';
        job.error = { message:e.message, code:e.code, details:e.details };
      }
      if (process.env.AI_DEBUG) console.warn('[AI][single-parameter] error', e.code||e.message, e.details||'', 'strict=', strict);
    }
  });
  res.json({ jobId });
});

router.get('/generate-parameter/job/:id', requireAuth, requirePermission('studies','create'), (req,res)=>{
  const job = aiJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error:'job no encontrado' });
  const payload = { id:job.id, status:job.status, progress:job.progress, message:job.message };
  if (job.status==='done') payload.parameter = job.result.parameter;
  if (job.status==='error') payload.error = job.error;
  res.json(payload);
});

router.get('/generate-study-details/job/:id', requireAuth, requirePermission('studies','create'), (req,res)=>{
  const job = aiJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error:'job no encontrado' });
  res.json({ id:job.id, status:job.status, progress:job.progress, message:job.message, result: job.status==='done'? job.result: undefined, error: job.status==='error'? job.error: undefined });
});

router.post('/generate-panel/async', requireAuth, requirePermission('studies','create'), async (req,res)=>{
  const { studyName } = req.body || {};
  if (!studyName || typeof studyName !== 'string') return res.status(400).json({ error:'studyName requerido' });
  const jobId = newJobId();
  const job = { id:jobId, type:'panel', status:'queued', progress:0, message:'En cola', createdAt:Date.now() };
  aiJobs.set(jobId, job);

  const raw = studyName.trim();
  const detectors = [
    { key:'hematology', regex:/biometr[ií]a hem(á|a)tica|hemograma( completo)?/i, params:[ 'Hemoglobina','Hematocrito','Eritrocitos','VCM','HCM','CHCM','RDW','Plaquetas','VMP','Leucocitos Totales','Neutrófilos Segmentados','Neutrófilos Banda','Linfocitos','Monocitos','Eosinófilos','Basófilos','Blastos','Metamielocitos','Mielocitos','Promielocitos' ] },
    { key:'thyroid', regex:/perfil\s+tiroid(eo|eo)|tiroideo/i, params:[ 'TSH','T4 Libre','T4 Total','T3 Total','T3 Libre','Anti-TPO','Anti-TG' ] },
    { key:'hepatic', regex:/perfil\s+hep(á|a)tic|hepático|hepatico/i, params:[ 'ALT (TGP)','AST (TGO)','Fosfatasa Alcalina','Bilirrubina Total','Bilirrubina Directa','Bilirrubina Indirecta','GGT','Albúmina','Proteínas Totales' ] },
    { key:'hormonal', regex:/perfil\s+hormonal/i, params:[ 'FSH','LH','Prolactina','Estradiol','Progesterona','Testosterona Total','Testosterona Libre','DHEA-S','Cortisol Matutino','Cortisol Vespertino' ] },
    { key:'gynecologic', regex:/perfil\s+ginecol(ó|o)gic|ginecologic/i, params:[ 'FSH','LH','Prolactina','Estradiol','Progesterona','Androstenediona','AMH','CA-125' ] },
    { key:'urinalysis', regex:/ex[aá]men general de orina|ego\b|examen general de orina/i, params:[ 'Color Orina','Aspecto Orina','Densidad','pH Orina','Glucosa Orina','Proteínas Orina','Cuerpos Cetónicos','Bilirrubina Orina','Urobilinógeno','Sangre Orina','Nitritos','Esterasa Leucocitaria','Leucocitos (Sedimento)','Eritrocitos (Sedimento)','Células Epiteliales','Bacterias' ] },
    { key:'geriatric', regex:/perfil\s+geri(á|a)tric|geriátrico|geriatrico/i, params:[ 'Glucosa','Creatinina','TSH','Vitamina D 25-OH','Albúmina','Hemoglobina','Colesterol Total','Triglicéridos','HDL','LDL Calculado','Calcio','Fósforo' ] },
    { key:'chem6', regex:/qu(í|i)mica sangu(í|i)nea.*6|quimica sanguinea.*6|qu(í|i)mica.*6 elementos/i, params:[ 'Glucosa','Urea','Creatinina','Ácido Úrico','Colesterol Total','Triglicéridos' ] }
  ,{ key:'electrolytes', regex:/electrolitos/i, params:[ 'Sodio','Potasio','Cloro','Calcio Ionizado','Magnesio','Bicarbonato','Fósforo' ] }
  ,{ key:'preop', regex:/perfil\s+pre( ?|-)operatorio|preoperatorio/i, params:[ 'Hemoglobina','Hematocrito','Glucosa','Creatinina','Plaquetas','TP','INR','TTPa','Grupo Sanguíneo','Factor Rh' ] }
  ,{ key:'bloodtype', regex:/tipo de sangre|grupo sangu(í|i)neo|\babo\b/i, params:[ 'Grupo Sanguíneo','Factor Rh','Coombs Directo' ] }
  ,{ key:'lipid', regex:/perfil\s+lip(í|i)dico|lipidico/i, params:[ 'Colesterol Total','Triglicéridos','HDL','LDL Calculado','VLDL','Colesterol No-HDL' ] }
  ,{ key:'renal', regex:/perfil\s+renal/i, params:[ 'Urea','BUN','Creatinina','Ácido Úrico','Depuración Creatinina','Calcio','Fósforo' ] }
  ,{ key:'cardiac', regex:/perfil\s+card(í|i)ac|card[ií]aco/i, params:[ 'Troponina I','CK Total','CK-MB','DHL','Mioglobina','BNP','Dímero D' ] }
  ];

  const match = detectors.find(d=> d.regex.test(raw));

  setImmediate(()=>{
    const panelKey = match?.key;
    job.status='working'; job.progress=10; job.message = panelKey? `Detectado panel ${panelKey}` : 'Generando panel base';
    if (!panelKey){
      job.result = { parameters:[], ai_meta:{ source:'templates', note:'no-canonical-match', ts:new Date().toISOString() } };
      job.progress=100; job.status='done'; job.message='Completado';
      return;
    }
    try {
      const { buildParameterTemplate } = require('../utils/referenceTemplates');
      const parameters = [];
      match.params.forEach(name => {
        const tpl = buildParameterTemplate(name);
        if (tpl) {
          parameters.push({ name, unit:tpl.unit, decimal_places:tpl.decimal_places, valorReferencia: tpl.valorReferencia.map(r=>({...r})) });
        } else {
          // placeholder structured
          const SEGMENTS = [ [0,1],[1,2],[2,12],[12,18],[18,65],[65,120] ];
          parameters.push({ name, unit:'', decimal_places:2, valorReferencia: SEGMENTS.map(([a,b])=>({ sexo:'Ambos', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'(Pendiente definir)' })) });
        }
      });
      job.progress=55; job.message='Rangos aplicados / placeholders';
      const SEGMENTS_LIST = [ [0,1],[1,2],[2,12],[12,18],[18,65],[65,120] ];
      const coverageIssues = [];
      parameters.forEach(p=>{
        const spans = new Set(p.valorReferencia.map(r=>`${r.edadMin}|${r.edadMax}`));
        SEGMENTS_LIST.forEach(([a,b])=>{ if (![...spans].some(s=>s===`${a}|${b}`)) coverageIssues.push(`${p.name}:${a}-${b}`); });
      });
      if (coverageIssues.length){ job.ai_warnings = { coverage: coverageIssues.slice(0,10) }; }
      job.progress=85; job.message='Panel completando';
      job.result = { parameters, ai_meta:{ source:'templates', panel:panelKey, ts:new Date().toISOString() } };
      job.progress=100; job.status='done'; job.message='Completado';
    } catch(e) {
      job.status='error'; job.message='Error generando panel'; job.error={ message:e.message };
    }
  });
  res.json({ jobId });
});

router.get('/generate-panel/job/:id', requireAuth, requirePermission('studies','create'), (req,res)=>{
  const job = aiJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error:'job no encontrado' });
  const payload = { id:job.id, status:job.status, type:job.type, progress:job.progress, message:job.message };
  if (job.status==='done') payload.result = job.result;
  if (job.status==='error') payload.error = job.error;
  res.json(payload);
});

// Exposición controlada para tests (no documentar como API pública)
if (process.env.NODE_ENV === 'test') {
  router.__ensureCoverageForTest = (payload, studyName) => ensureCoverage(payload, studyName||'test');
}

module.exports = router;
