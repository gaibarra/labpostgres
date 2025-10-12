#!/usr/bin/env node
/**
 * applyAnalysisDescriptions.js
 * Aplica descripciones/indicaciones por estudio leyendo data/analysis_descriptions.json
 * Coincide por code (si existe) o por nombre (case/diacríticos-insensitive).
 * Solo sobrescribe cuando la descripción es genérica/vacía, salvo que se pase --force.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_) { /* ignore */ }

function parseArgs(){
  const out={ force:false, db:null };
  for (const a of process.argv.slice(2)){
    const m=a.match(/^--([^=]+)(=(.*))?$/);
    if (!m) continue;
    const k=m[1]; const v=(m[3]!==undefined?m[3]:true);
    if (k==='force') out.force = String(v)!=='false';
    else if (k==='db') out.db = v;
  }
  return out;
}

// (normalización no requerida por ahora)

async function hasColumn(pool, table, col){
  const { rows } = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1", [table, col]);
  return !!rows[0];
}

async function main(){
  const args = parseArgs();
  const filePath = path.resolve(__dirname, 'data', 'analysis_descriptions.json');
  if (!fs.existsSync(filePath)) {
    console.error('[APPLY-DESC] Archivo no encontrado:', filePath);
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(filePath,'utf8'));
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: args.db || process.env.PGDATABASE
  });
  try {
    const hasAnalysis = (await pool.query("SELECT to_regclass('public.analysis') t")).rows[0].t;
    if (!hasAnalysis) { console.log('[APPLY-DESC] Tabla analysis no existe. Nada que hacer.'); return; }
    const hasCode = await hasColumn(pool,'analysis','code');
    const canWriteMeta = {
      description: await hasColumn(pool,'analysis','description'),
      indications: await hasColumn(pool,'analysis','indications'),
      sample_type: await hasColumn(pool,'analysis','sample_type'),
      sample_container: await hasColumn(pool,'analysis','sample_container'),
      processing_time_hours: await hasColumn(pool,'analysis','processing_time_hours')
    };
  let updated=0, skipped=0;
  // 1) Aplicar mapeo explícito desde JSON
  for (const it of items){
      const matchName = it.match?.name || null;
      const matchAliases = Array.isArray(it.match?.aliases) ? it.match.aliases.filter(Boolean) : [];
      const nameCandidates = [matchName, ...matchAliases].filter(Boolean);
      const matchCode = it.match?.code || null;
      let row=null;
      if ((hasCode && matchCode) || nameCandidates.length){
        // Construimos consulta dinámica para buscar por code o por cualquiera de los aliases/nombre
        const conds=[]; const vals=[];
        if (hasCode && matchCode) { conds.push(`LOWER(code)=LOWER($${conds.length+1})`); vals.push(matchCode); }
        for (const nc of nameCandidates){ conds.push(`LOWER(name)=LOWER($${conds.length+1})`); vals.push(nc); }
        const { rows } = await pool.query(`SELECT * FROM analysis WHERE ${conds.join(' OR ')} LIMIT 1`, vals);
        row = rows[0]||null;
      } else {
        continue;
      }
      if (!row) { skipped++; continue; }
      const desc = it.description || null;
      const ind = it.indications || null;
      const st = it.sample_type || null;
      const sc = it.sample_container || null;
      const pth = it.processing_time_hours ?? null;
      // Condición genérica
      const isGenDesc = !row.description || /^(\s*)$/.test(row.description) || /estudio de laboratorio cl[ií]nico\.?/i.test(row.description.trim());
      const isGenInd = !row.indications || /^(\s*)$/.test(row.indications) || /seg[uú]n criterio cl[ií]nico y sospecha diagn[oó]stica\.?/i.test(row.indications.trim());
      const sets=[]; const vals=[];
      const wantForce = !!args.force;
      if (canWriteMeta.description && desc && (wantForce || isGenDesc)) { sets.push(`description=$${sets.length+1}`); vals.push(desc); }
      if (canWriteMeta.indications && ind && (wantForce || isGenInd)) { sets.push(`indications=$${sets.length+1}`); vals.push(ind); }
      if (canWriteMeta.sample_type && st && (wantForce || !row.sample_type)) { sets.push(`sample_type=$${sets.length+1}`); vals.push(st); }
      if (canWriteMeta.sample_container && sc && (wantForce || !row.sample_container)) { sets.push(`sample_container=$${sets.length+1}`); vals.push(sc); }
      if (canWriteMeta.processing_time_hours && pth!=null && (wantForce || row.processing_time_hours==null)) { sets.push(`processing_time_hours=$${sets.length+1}`); vals.push(pth); }
      if (!sets.length) { skipped++; continue; }
      vals.push(row.id);
      await pool.query(`UPDATE analysis SET ${sets.join(', ')} WHERE id=$${vals.length}`, vals);
      updated++;
    }

    // 2) Completar el resto de estudios con descripción genérica o vacía generando textos automáticos
    // Heurística: usar lista de parámetros + categoría para armar description/indications y setear sample_type/container si faltan

    // helpers
    const catDefaults = (cat) => {
      const k = (cat||'').toLowerCase();
      if (k.includes('hema')) return { st:'Sangre total', sc:'Tubo morado (EDTA)', ind:'Tamizaje hematológico, anemia, infecciones, sangrado y seguimiento clínico.' };
      if (k.includes('orina')) return { st:'Orina', sc:'Vaso estéril de orina', ind:'Evaluación de patología urinaria/renal, infecciones y tamizaje general.' };
      if (k.includes('hormon')) return { st:'Suero', sc:'Tubo rojo o amarillo (SST)', ind:'Trastornos endocrinos, fertilidad, seguimiento terapéutico; considerar horario/método.' };
      if (k.includes('bioq') || k.includes('quím') || k.includes('quim')) return { st:'Suero', sc:'Tubo rojo o amarillo (SST)', ind:'Metabolismo, función hepática/renal, dislipidemias, glucosa; control de crónicos.' };
      if (k.includes('micro')) return { st:'Aislamiento bacteriano', sc:'Medio de cultivo', ind:'Sospecha de infección; orientar toma de muestra y antibiograma cuando corresponda.' };
      if (k.includes('copro') || k.includes('fecal') || k.includes('heces')) return { st:'Materia fecal', sc:'Frasco estéril para heces', ind:'Diarrea, dolor abdominal, malabsorción; control post-tratamiento.' };
      if (k.includes('parasit')) return { st:'Materia fecal', sc:'Frasco estéril (según técnica)', ind:'Sospecha de parasitosis intestinal; tamizaje y control de erradicación.' };
      if (k.includes('card')) return { st:'Suero', sc:'Tubo rojo o amarillo (SST)', ind:'Dolor torácico, isquemia, estratificación de riesgo y seguimiento.' };
      if (k.includes('renal')) return { st:'Suero', sc:'Tubo rojo o amarillo (SST)', ind:'Enfermedad renal, alteraciones hidroelectrolíticas y metabolismo mineral.' };
      return { st:'Suero', sc:'Tubo rojo o amarillo (SST)', ind:'Solicitar según cuadro clínico y utilidad diagnóstica esperada.' };
    };

    const listParams = async (analysisId) => {
      const { rows } = await pool.query(
        'SELECT name FROM analysis_parameters WHERE analysis_id=$1 ORDER BY position NULLS LAST, name LIMIT 10',
        [analysisId]
      );
      return rows.map(r => r.name);
    };

    const buildAutoTexts = (row, pnames) => {
      const cat = row.category || '';
      const cdef = catDefaults(cat);
      let description;
      if (pnames.length >= 2) {
        const maxShow = 6;
        const shown = pnames.slice(0, maxShow);
        const remaining = pnames.length - shown.length;
        const list = shown.join(', ');
        const tail = remaining > 0 ? ` y ${remaining} más` : '';
        description = cat ? `Panel de ${cat} que incluye: ${list}${tail}.` : `Panel que incluye: ${list}${tail}.`;
      } else if (pnames.length === 1) {
        description = `Determinación de ${pnames[0]}.`;
      } else {
        // Si no hay categoría ni parámetros, evitar la frase genérica y usar el nombre del estudio
        if (cat) {
          description = `Estudio de ${cat.toLowerCase()}.`;
        } else if (row.name) {
          description = `Estudio: ${row.name}.`;
        } else {
          description = 'Estudio de laboratorio clínico.';
        }
      }
      const indications = cdef.ind;
      const sample_type = row.sample_type || cdef.st;
      const sample_container = row.sample_container || cdef.sc;
      return { description, indications, sample_type, sample_container };
    };

    // Seleccionar candidatos: descripción genérica o vacía
    const { rows: candidates } = await pool.query(
      `SELECT id, name, category, description, indications, sample_type, sample_container, processing_time_hours
         FROM analysis`
    );

    for (const row of candidates){
      const isGenDesc = !row.description || /^(\s*)$/.test(row.description) || /estudio de laboratorio cl[ií]nico\.?/i.test((row.description||'').trim());
      const isGenInd = !row.indications || /^(\s*)$/.test(row.indications) || /seg[uú]n criterio cl[ií]nico y sospecha diagn[oó]stica\.?/i.test((row.indications||'').trim());
      const wantForce = !!args.force;
      const isMissingCategory = (row.category==null || /^(\s*)$/.test(row.category));
      if (!wantForce && !isGenDesc && !isGenInd && row.sample_type && row.sample_container && row.processing_time_hours!=null && !isMissingCategory) { continue; }
      const pnames = await listParams(row.id);
      const auto = buildAutoTexts(row, pnames);
      const sets=[]; const vals=[];
      // Si no hay categoría, asignar "Otros" de forma segura
      if ((row.category==null || /^(\s*)$/.test(row.category)) ) { sets.push(`category=$${sets.length+1}`); vals.push('Otros'); }
      if (canWriteMeta.description && (wantForce || isGenDesc)) { sets.push(`description=$${sets.length+1}`); vals.push(auto.description); }
      if (canWriteMeta.indications && (wantForce || isGenInd)) { sets.push(`indications=$${sets.length+1}`); vals.push(auto.indications); }
      if (canWriteMeta.sample_type && (wantForce || !row.sample_type)) { sets.push(`sample_type=$${sets.length+1}`); vals.push(auto.sample_type); }
      if (canWriteMeta.sample_container && (wantForce || !row.sample_container)) { sets.push(`sample_container=$${sets.length+1}`); vals.push(auto.sample_container); }
      if (canWriteMeta.processing_time_hours && (wantForce || row.processing_time_hours==null)) { sets.push(`processing_time_hours=$${sets.length+1}`); vals.push(row.processing_time_hours ?? 8); }
      if (!sets.length) { continue; }
      vals.push(row.id);
      await pool.query(`UPDATE analysis SET ${sets.join(', ')} WHERE id=$${vals.length}`, vals);
      updated++;
    }

    console.log('[APPLY-DESC] Actualizados: %d, omitidos: %d', updated, skipped);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(e=>{ console.error('[APPLY-DESC] Error:', e.message); process.exit(1); });
}

module.exports = { };
