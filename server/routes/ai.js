const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// === Helpers & Async Job Infra ===
const aiJobs = new Map();
function newJobId(){ return 'job_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }

async function getApiKey(){
  try {
    const { rows } = await pool.query("SELECT integrations_settings->>'openaiApiKey' AS key FROM lab_configuration LIMIT 1");
    return rows[0]?.key?.trim();
  } catch(e){
    if (process.env.AI_DEBUG) console.warn('[AI] Error leyendo configuración para API key', e.message);
    return null;
  }
}

function buildPrompt(studyName){
  return `Eres un asistente experto en laboratorio clínico. Genera un JSON REALISTA y EXHAUSTIVO para un estudio con este nombre: "${studyName}".\nRequisitos IMPORTANTES para cada parámetro:\n1. Debe incluir valores de referencia (valorReferencia) que cubran TODA la vida humana desde 0 hasta 120 años (unidadEdad='años') sin huecos y en orden ascendente.\n2. Incluir ambos sexos (Masculino y Femenino) salvo que el parámetro NO aplique a un sexo (ej: prueba de embarazo solo Femenino, PSA/antígeno prostático solo Masculino). No inventar rangos para sexos a los que no aplica; en ese caso omitir totalmente ese sexo.\n3. Puedes segmentar por etapas (0-1, 2-12, 13-17, 18-45, 46-65, 66-120) o rangos clínicamente relevantes; evita superposiciones.\n4. decimal_places coherente con la magnitud.\n5. Si algún tramo carece de valores clínicos establecidos, usar valorMin=null y valorMax=null y notas=\"Sin referencia establecida\".\n6. nombres de parámetros en español clínico estándar.\n7. NO incluir explicaciones fuera del JSON.\nEstructura exacta:\n{ name: string, description: string, indications: string, sample_type: string, sample_container: string, processing_time_hours: number | null, category: string, parameters: [ { name: string, unit: string, decimal_places: number, valorReferencia: [ { sexo: 'Ambos'|'Masculino'|'Femenino', edadMin: number|null, edadMax: number|null, unidadEdad: 'años', valorMin: number|null, valorMax: number|null, textoPermitido?: string, textoLibre?: string, notas?: string } ] } ] }\nResponde SOLO con JSON válido.`;
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
  const clamp = (v)=> (v == null ? v : (v < 0 ? 0 : (v > 120 ? 120 : v)));
  function ensureCoverage(param){
    if (!Array.isArray(param.valorReferencia)) { param.valorReferencia = []; return; }
    const name = param.name || '';
    const femaleOnly = femaleOnlyPatterns.test(name);
    const maleOnly = maleOnlyPatterns.test(name);
    const needMale = !femaleOnly;
    const needFemale = !maleOnly;
    const bySex = { Masculino: [], Femenino: [] };
    for (const vr of param.valorReferencia) {
      const sexo = vr.sexo === 'Masculino' || vr.sexo === 'Femenino' ? vr.sexo : (vr.sexo === 'Ambos' ? 'Ambos' : 'Ambos');
      if (sexo === 'Ambos') { bySex.Masculino.push(vr); bySex.Femenino.push(vr); } else { bySex[sexo].push(vr); }
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
  function tryParse(content){
    try { return { ok:true, value: JSON.parse(content) }; } catch(e) {}
    // intento: recortar hasta último } balance
    const first = content.indexOf('{');
    const last = content.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last>first){
      const slice = content.slice(first, last+1);
      try { return { ok:true, value: JSON.parse(slice), salvaged:true }; } catch(e) {}
    }
    // quitar comas colgantes
    const noTrailing = content.replace(/,\s*(}[\]])/g,'$1');
    try { return { ok:true, value: JSON.parse(noTrailing), salvaged:true }; } catch(e) {}
    return { ok:false };
  }

  let attempt = 0; let parsed;
  const maxAttempts = 2; let lastRaw=''; let salvaged = false;
  while (attempt < maxAttempts){
    attempt++;
    progressCb && progressCb(25 + attempt*5, attempt===1? 'llamando a OpenAI' : 'reintento IA');
    const data = await callOpenAI({
      model:'gpt-4o-mini',
      messages:[
        { role:'system', content: 'Asistente de laboratorio clínico. Devuelve SOLO JSON válido sin texto extra.' },
        { role:'user', content: attempt===1 ? prompt : (prompt + '\nSI EL INTENTO ANTERIOR FUE INVÁLIDO: ahora genera una versión compacta con <= 12 parámetros.') }
      ],
      temperature:0.3,
      max_tokens: 3000,
      response_format:{ type:'json_object' }
    });
    progressCb && progressCb(50 + attempt*5,'procesando respuesta');
    let content = cleanContent(data?.choices?.[0]?.message?.content);
    lastRaw = content;
    const attemptParse = tryParse(content);
    if (attemptParse.ok){
      parsed = attemptParse.value; salvaged = !!attemptParse.salvaged; break;
    }
  }
  if (!parsed){
    throw Object.assign(new Error('Respuesta IA no es JSON válido tras reintentos'), { code:'OPENAI_BAD_JSON', raw: lastRaw.slice(0,600) });
  }
  progressCb && progressCb(75,'normalizando');
  const payload = ensureCoveragePost(parsed, studyName);
  if (salvaged) payload.ai_meta.salvaged = true;
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
      job.error = { message: e.message, code: e.code, details: e.details, raw: e.raw };
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
