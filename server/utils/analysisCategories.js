// Catálogo de categorías profesionales permitidas y utilidades
const CATEGORIES = [
  'Hematología',
  'Coagulación',
  'Química Clínica',
  'Electrolitos',
  'Función Hepática',
  'Perfil Lipídico',
  'Función Renal',
  'Endocrinología',
  'Inmunología/Serología',
  'Microbiología',
  'Orina',
  'Heces',
  'Gases en Sangre',
  'Cardiaco',
  'Toxicología',
  'Virología',
  'Genética/Molecular',
  'Prenatal',
  'Vitaminas',
  'Otros'
];

function isValidCategory(cat){
  return !!cat && CATEGORIES.includes(cat);
}

// Normaliza texto: minúsculas y sin diacríticos
function normalizeKey(s){
  return String(s||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .trim();
}

// Mapa de sinónimos -> categoría canónica
const CATEGORY_SYNONYMS = new Map([
  // Hematología
  ['hematologia','Hematología'],
  ['hemograma','Hematología'],
  ['biometria hematica','Hematología'],
  ['biometria','Hematología'],

  // Coagulación
  ['coagulacion','Coagulación'],

  // Química Clínica
  ['bioquimica','Química Clínica'],
  ['quimica sanguinea','Química Clínica'],
  ['quimica clinica','Química Clínica'],
  ['metabolico','Química Clínica'],
  ['metabolismo','Química Clínica'],

  // Electrolitos
  ['electrolitos','Electrolitos'],

  // Función Hepática
  ['funcion hepatica','Función Hepática'],
  ['hepatico','Función Hepática'],
  ['hepatica','Función Hepática'],
  ['perfil hepatico','Función Hepática'],

  // Perfil Lipídico
  ['perfil lipidico','Perfil Lipídico'],
  ['lipidos','Perfil Lipídico'],

  // Función Renal
  ['funcion renal','Función Renal'],
  ['renal','Función Renal'],

  // Endocrinología
  ['hormonas','Endocrinología'],
  ['endocrino','Endocrinología'],
  ['endocrinologia','Endocrinología'],
  
  ['perfil tiroideo','Endocrinología'],

  // Inmunología/Serología
  ['inmunologia','Inmunología/Serología'],
  ['serologia','Inmunología/Serología'],
  ['inmunologia/serologia','Inmunología/Serología'],

  // Microbiología
  ['microbiologia','Microbiología'],
  ['bacteriologia','Microbiología'],

  // Orina
  ['orina','Orina'],
  ['urinario','Orina'],

  // Heces
  ['heces','Heces'],
  ['coprologia','Heces'],
  ['copro','Heces'],
  ['coproparasitoscopico','Heces'],

  // Gases en Sangre
  ['gases','Gases en Sangre'],
  ['gasometria','Gases en Sangre'],
  ['gases en sangre','Gases en Sangre'],

  // Cardiaco
  ['cardiaco','Cardiaco'],
  ['cardiaco','Cardiaco'],
  ['cardiologia','Cardiaco'],
  ['cardiologico','Cardiaco'],

  // Toxicología
  ['toxicologia','Toxicología'],
  ['toxico','Toxicología'],

  // Virología
  ['virologia','Virología'],

  // Genética/Molecular
  ['genetica','Genética/Molecular'],
  ['molecular','Genética/Molecular'],

  // Prenatal
  ['prenatal','Prenatal'],
  ['embarazo','Prenatal'],

  // Vitaminas
  ['vitaminas','Vitaminas'],

  // Otros
  ['otros','Otros'],
  ['miscelaneo','Otros'],
  ['misc','Otros']
]);

function canonicalizeCategory(input){
  if (!input) return null;
  if (isValidCategory(input)) return input; // ya es válida
  const key = normalizeKey(input);
  if (CATEGORY_SYNONYMS.has(key)) return CATEGORY_SYNONYMS.get(key);
  // tolerancia a tildes exacta por comparación normalizada
  for (const cat of CATEGORIES){
    if (normalizeKey(cat) === key) return cat;
  }
  return null;
}

module.exports = { CATEGORIES, isValidCategory, canonicalizeCategory };
