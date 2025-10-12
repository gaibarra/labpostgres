// Utility to flag parameters that are qualitative by design.
// We normalize accents/diacritics and compare in lowercase.

function normalize(s){
  return (s||'')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .trim();
}

// Exact names known to be qualitative (analysis parameter names)
const EXACT = new Set([
  'color orina',
  'aspecto orina',
  'cuerpos cetonicos',
  'cuerpos cetónicos', // in case
  'bilirrubina orina',
  'urobilinogeno',
  'urobilinógeno',
  'sangre orina',
  'nitritos',
  'esterasa leucocitaria',
  'grupo sanguineo',
  'grupo sanguíneo',
  'factor rh',
  'rh',
  'coombs directo',
  'ph orina',
  'densidad',
  'hcg cualitativa en orina',
  'hcg orina cualitativa',
  'prueba de embarazo en orina (cualitativa)',
  'indice de heinz',
  'índice de heinz',
  'beta-glucuronidasa seminal',
  'β-glucuronidasa seminal',
  // Immunology qualitative panels
  'ana (titulo/patron)',
  'ana (título/patrón)',
  'anca c-anca (pr3)',
  'anca p-anca (mpo)',
  'anti-ena rnp',
  'anti-ena sm',
  'anti-ssa (ro)',
  'anti-ssb (la)',
  'anti-scl-70',
  'anti-vhc (hcv ab)',
  'anti-hbc igm',
  'anti-hbc total',
  'anti-hbe',
  'anti-hbs',
  'anti-dsdna',
  'anti-gbm',
  'anti-ccp',
  'anti-β2 glicoproteina i igg',
  'anti-β2 glicoproteina i igm',
  'anti-β2 glicoproteína i igg',
  'anti-β2 glicoproteína i igm',
  // Microbiology report structure
  'antibiograma',
  'organismo',
  'metodo (kirby-bauer/mic/etest)',
  'método (kirby-bauer/mic/etest)',
  'estandar (clsi/eucast)',
  'estándar (clsi/eucast)',
  // Additional qualitative-only parameters from audits
  'version estandar',
  'versión estándar',
  'anti-jo-1',
  'anticardiolipina igg',
  'anticardiolipina igm',
  'dengue ns1',
  'cetonas urinarias (cualitativo)',
  'cilindros hialinos urinarios',
  'ig e especifica (un alergeno)',
  'ige especifica (un alergeno)',
  'ige específica (un alérgeno)',
  'ig g especifica (un antigeno)',
  'igg especifica (un antigeno)',
  'igg específica (un antígeno)',
  'rpr',
  'vdrl',
  'tp-pa / fta-abs',
  'tp pa / fta abs',
  'vih ag/ac combo',
  // Copro microscopy elements
  'quistes',
  'trofozoitos',
  'trofozoítos',
  'huevos de helmintos',
  'larvas',
  'levaduras',
  'flora bacteriana',
  'moco'
]);

// Keyword patterns that strongly indicate qualitative results
const KEYWORDS = [
  'cualitativa',
  'aglut', // aglutinación/aglutinaciones
  'positivo',
  'negativo',
  'reactivo',
  'no reactivo'
];

// Additional regex/patterns for inherently qualitative modalities
const VIRAL_BACTERIAL_TOKENS = [
  'sars', 'cov', 'cov-2', 'cov2', 'vih', 'hiv', 'hcv', 'hbv', 'vcm', 'ebv', 'cmv',
  'zika', 'dengue', 'chikungunya', 'influenza', 'treponema', 'gonorrhoeae', 'gonorrea', 'rsv', 'rotavirus', 'adenovirus', 'norovirus', 'giardia', 'cryptosporidium', 'helicobacter',
  'rubeola', 'rubéola', 'toxoplasma'
].map(s=>s.toLowerCase());

// Enrich allowlist with additional known qualitative tests (normalized)
['sangre oculta en heces (fit)','sangre oculta en heces (guayaco)','monotest (heterofilos)','monotest (heterófilos)',
 'hbsag','hbeag','hcv rna (carga viral)','hbv dna (carga viral)','carga viral vih (rna)',
 'sars-cov-2 pcr','sars-cov-2 antigeno','sars-cov-2 antígeno','treponema pallidum pcr',
 'rsv antígeno/pcr','naat','prueba de aliento con urea',
 // Copro/stool qualitative panel entries
 'color heces','consistencia','moco en heces','sangre oculta','azucares reductores','azúcares reductores','grasas fecales','leucocitos fecales','eritrocitos fecales','restos alimenticios','redactores en heces','reductores en heces',
 // Urinalysis qualitative
 'glucosa orina','proteinas orina','proteínas orina']
  .forEach(s => EXACT.add(s));

function isQualitativeByDesign(name){
  const n = normalize(name);
  if (!n) return false;
  if (EXACT.has(n)) return true;
  // Pattern-based: NAAT/carga viral are qualitative/informational; antigen only when infectious-context
  if (n.includes('naat') || n.includes('carga viral')) return true;
  if ((n.includes('antigeno') || n.includes('antígeno')) && (VIRAL_BACTERIAL_TOKENS.some(tok => n.includes(tok)) || n.includes('heces') || n.includes('respirator') )) return true;
  // PCR for infectious agents (avoid colliding with Proteína C Reactiva also called PCR)
  if (n.includes(' pcr') || n.startsWith('pcr ') || n.endsWith(' pcr')){
    if (VIRAL_BACTERIAL_TOKENS.some(tok => n.includes(tok))) return true;
  }
  // Serologies IgM/IgG for infectious agents often qualitative/index
  if ((n.includes(' igm') || n.includes(' igg')) && VIRAL_BACTERIAL_TOKENS.some(tok => n.includes(tok))) return true;
  return KEYWORDS.some(k => n.includes(k));
}

module.exports = { isQualitativeByDesign };
