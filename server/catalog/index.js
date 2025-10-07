let catalog = require('./clinicalParameters');

// Mapa de alias manuales adicionales que quizá no estén listados en cada objeto
const EXTRA_ALIASES = {
  'sgot':'tgo_ast',
  'asttgo':'tgo_ast',
  'sgpt':'tgp_alt',
  'alttgp':'tgp_alt',
  'gpt':'tgp_alt',
  'gptalt':'tgp_alt'
};

function normalizeKey(s){
  return (s||'')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu,'')
    .replace(/[^a-z0-9]+/g,'')
    .trim();
}

function findParameter(rawName){
  if (!rawName) return null;
  const nk = normalizeKey(rawName);
  // Direct by synonyms
  let hit = catalog.parameters.find(p => p.synonyms.some(s => normalizeKey(s) === nk));
  if (hit) return hit;
  // Buscar por clave directa
  hit = catalog.parameters.find(p => normalizeKey(p.key) === nk);
  if (hit) return hit;
  // Alias extra
  if (EXTRA_ALIASES[nk]) {
    const target = EXTRA_ALIASES[nk];
    hit = catalog.parameters.find(p => p.key === target);
    if (hit) return hit;
  }
  return null;
}

function toResponse(p){
  return {
    name: p.canonicalName,
    unit: p.unit,
    decimal_places: p.decimal_places,
    method: p.method || '',
    assayNotes: p.assayNotes || '',
    validated: !!p.validated,
    lockAI: !!p.lockAI,
    decision_points: p.decisionPoints || p.decision_points || [],
    reference_notes: p.referenceNotes || p.reference_notes || '',
    position: null,
    reference_ranges: (p.groups||[]).map(g => ({
      sex: g.sex,
      age_min: g.min,
      age_max: g.max,
      age_min_unit: 'años',
      lower: g.lower ?? null,
      upper: g.upper ?? null,
      text_value: null,
      source: 'catalog'
    })),
    notes: p.notes,
    ai_meta: { source:'catalog', catalogVersion: catalog.version, updatedAt: catalog.updatedAt }
  };
}

function listParameters(){
  return catalog.parameters.map(p => ({
    key: p.key,
    name: p.canonicalName,
    unit: p.unit,
    validated: !!p.validated,
    lockAI: !!p.lockAI,
    method: p.method || '',
    categories: p.categoryHints || []
  }));
}
function reloadCatalog(){
  delete require.cache[require.resolve('./clinicalParameters')];
  catalog = require('./clinicalParameters');
  return { version: catalog.version, updatedAt: catalog.updatedAt, count: catalog.parameters.length };
}
function buildETag(){
  // Sencillo: hash por longitud + version + count
  const count = catalog.parameters.length;
  return 'W/"'+[catalog.version,count].join('-')+'"';
}
module.exports = { catalog, findParameter, toResponse, listParameters, normalizeKey, reloadCatalog, buildETag };
