#!/usr/bin/env node
/**
 * setBiometriaHematicaExact.js
 * Establece EXACTAMENTE los rangos de referencia solicitados para Biometría Hemática.
 * - Reemplaza (DELETE + INSERT) los rangos por parámetro
 * - Ajusta unidad y decimales en analysis_parameters
 * - Usa age_min_unit='años' y sex en minúsculas: 'ambos'|'masculino'|'femenino'
 *
 * Uso:
 *   node server/scripts/setBiometriaHematicaExact.js           # dry-run
 *   node server/scripts/setBiometriaHematicaExact.js --apply   # aplica cambios
 */
const { pool } = require('../db');

// Sinónimos comunes para localizar parámetros aunque tengan nombres alternativos
const ALIASES = {
  'Hemoglobina': ['Hemoglobina','Hb'],
  'Hematocrito': ['Hematocrito','Hto','Ht'],
  'Eritrocitos': ['Eritrocitos','Recuento de Eritrocitos','Eritrocitos Totales','RBC','Recuento Eritrocitario'],
  'VCM': ['VCM','Volumen Corpuscular Medio','MCV'],
  'HCM': ['HCM','Hemoglobina Corpuscular Media','MCH'],
  'CHCM': ['CHCM','Concentración de Hb Corpuscular Media','MCHC'],
  'RDW': ['RDW','Amplitud de Distribución Eritrocitaria','RDW-CV'],
  'Plaquetas': ['Plaquetas','Recuento de Plaquetas','PLT'],
  'VMP': ['VMP','VPM','Volumen Plaquetario Medio','Volumen Medio Plaquetario','MPV'],
  'Leucocitos Totales': ['Leucocitos Totales','Leucocitos','Recuento de Leucocitos','WBC'],
  'Neutrófilos Segmentados': ['Neutrófilos Segmentados','Segmentados','Neutrófilos % Segmentados','Neu Seg'],
  'Neutrófilos Banda': ['Neutrófilos Banda','Cayados','Banda','Neu Banda','Neu Band'],
  'Linfocitos': ['Linfocitos','Linfocitos %','Lymphocytes'],
  'Monocitos': ['Monocitos','Monocitos %','Monocytes'],
  'Eosinófilos': ['Eosinófilos','Eosinofilos','Eosinófilos %','Eosinophils'],
  'Basófilos': ['Basófilos','Basofilos','Basófilos %','Basophils'],
  'Blastos': ['Blastos','Blastos %','Blasts'],
  'Metamielocitos': ['Metamielocitos','Metamyelocytes','Metamielocitos %'],
  'Mielocitos': ['Mielocitos','Myelocytes','Mielocitos %'],
  'Promielocitos': ['Promielocitos','Promyelocytes','Promielocitos %']
};

function diffRanges(name){
  const base = (lower, upper) => ([
    { sex: 'ambos', a0: 0, a1: 1, lower, upper },
    { sex: 'ambos', a0: 1, a1: 2, lower, upper },
    { sex: 'ambos', a0: 2, a1: 12, lower, upper },
    { sex: 'ambos', a0: 12, a1: 18, lower, upper },
    { sex: 'ambos', a0: 18, a1: 65, lower, upper },
    { sex: 'ambos', a0: 65, a1: 120, lower, upper },
  ]);
  switch (name) {
    case 'Neutrófilos Segmentados':
      return [
        { sex:'ambos', a0:0, a1:1, lower:50, upper:70 },
        { sex:'ambos', a0:1, a1:2, lower:30, upper:60 },
        { sex:'ambos', a0:2, a1:12, lower:35, upper:65 },
        { sex:'ambos', a0:12, a1:18, lower:40, upper:70 },
        { sex:'ambos', a0:18, a1:65, lower:40, upper:75 },
        { sex:'ambos', a0:65, a1:120, lower:40, upper:75 },
      ];
    case 'Neutrófilos Banda':
      return [
        { sex:'ambos', a0:0, a1:1, lower:0, upper:10 },
        { sex:'ambos', a0:1, a1:2, lower:0, upper:6 },
        { sex:'ambos', a0:2, a1:12, lower:0, upper:6 },
        { sex:'ambos', a0:12, a1:18, lower:0, upper:6 },
        { sex:'ambos', a0:18, a1:65, lower:0, upper:6 },
        { sex:'ambos', a0:65, a1:120, lower:0, upper:6 },
      ];
    case 'Linfocitos':
      return [
        { sex:'ambos', a0:0, a1:1, lower:20, upper:40 },
        { sex:'ambos', a0:1, a1:2, lower:40, upper:60 },
        { sex:'ambos', a0:2, a1:12, lower:30, upper:60 },
        { sex:'ambos', a0:12, a1:18, lower:20, upper:45 },
        { sex:'ambos', a0:18, a1:65, lower:20, upper:45 },
        { sex:'ambos', a0:65, a1:120, lower:20, upper:45 },
      ];
    case 'Monocitos':
      return [
        { sex:'ambos', a0:0, a1:1, lower:2, upper:12 },
        { sex:'ambos', a0:1, a1:2, lower:2, upper:10 },
        { sex:'ambos', a0:2, a1:12, lower:2, upper:10 },
        { sex:'ambos', a0:12, a1:18, lower:2, upper:10 },
        { sex:'ambos', a0:18, a1:65, lower:2, upper:10 },
        { sex:'ambos', a0:65, a1:120, lower:2, upper:10 },
      ];
    case 'Eosinófilos':
      return base(0, 5);
    case 'Basófilos':
      return base(0, 1);
    case 'Blastos':
    case 'Metamielocitos':
    case 'Mielocitos':
    case 'Promielocitos':
      return base(0, 0);
    default:
      return [];
  }
}

const SPECS = [
  {
    name: 'Hemoglobina', unit: 'g/dL', decimals: 1,
    ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 13.5, upper: 20 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 11.0, upper: 13.5 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 11.5, upper: 14.5 },
      { sex: 'femenino', a0: 12, a1: 18, lower: 12.0, upper: 15.0 },
      { sex: 'masculino', a0: 12, a1: 18, lower: 13.0, upper: 16.0 },
      { sex: 'femenino', a0: 18, a1: 65, lower: 12.0, upper: 16.0 },
      { sex: 'masculino', a0: 18, a1: 65, lower: 13.5, upper: 17.5 },
      { sex: 'femenino', a0: 65, a1: 120, lower: 11.5, upper: 15.5 },
      { sex: 'masculino', a0: 65, a1: 120, lower: 13.0, upper: 17.0 },
    ],
  },
  {
    name: 'Hematocrito', unit: '%', decimals: 0,
    ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 42, upper: 65 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 33, upper: 39 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 35, upper: 45 },
      { sex: 'femenino', a0: 12, a1: 18, lower: 36, upper: 46 },
      { sex: 'masculino', a0: 12, a1: 18, lower: 37, upper: 49 },
      { sex: 'femenino', a0: 18, a1: 65, lower: 36, upper: 46 },
      { sex: 'masculino', a0: 18, a1: 65, lower: 41, upper: 53 },
      { sex: 'femenino', a0: 65, a1: 120, lower: 35, upper: 47 },
      { sex: 'masculino', a0: 65, a1: 120, lower: 38, upper: 52 },
    ],
  },
  {
    name: 'Eritrocitos', unit: 'x10^6/µL', decimals: 2,
    ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 4.0, upper: 6.6 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 3.7, upper: 5.3 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 4.0, upper: 5.2 },
      { sex: 'femenino', a0: 12, a1: 18, lower: 4.1, upper: 5.1 },
      { sex: 'masculino', a0: 12, a1: 18, lower: 4.5, upper: 5.5 },
      { sex: 'femenino', a0: 18, a1: 65, lower: 4.2, upper: 5.4 },
      { sex: 'masculino', a0: 18, a1: 65, lower: 4.7, upper: 6.1 },
      { sex: 'femenino', a0: 65, a1: 120, lower: 4.0, upper: 5.2 },
      { sex: 'masculino', a0: 65, a1: 120, lower: 4.4, upper: 5.8 },
    ],
  },
  { name: 'VCM', unit: 'fL', decimals: 1, ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 95, upper: 120 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 72, upper: 84 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 78, upper: 90 },
      { sex: 'ambos', a0: 12, a1: 18, lower: 80, upper: 94 },
      { sex: 'ambos', a0: 18, a1: 65, lower: 80, upper: 96 },
      { sex: 'ambos', a0: 65, a1: 120, lower: 80, upper: 100 },
    ] },
  { name: 'HCM', unit: 'pg', decimals: 1, ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 30, upper: 37 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 24, upper: 30 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 25, upper: 33 },
      { sex: 'ambos', a0: 12, a1: 18, lower: 26, upper: 34 },
      { sex: 'ambos', a0: 18, a1: 65, lower: 27, upper: 34 },
      { sex: 'ambos', a0: 65, a1: 120, lower: 27, upper: 34 },
    ] },
  { name: 'CHCM', unit: 'g/dL', decimals: 1, ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 30, upper: 36 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 32, upper: 36 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 32, upper: 36 },
      { sex: 'ambos', a0: 12, a1: 18, lower: 32, upper: 36 },
      { sex: 'ambos', a0: 18, a1: 65, lower: 32, upper: 36 },
      { sex: 'ambos', a0: 65, a1: 120, lower: 32, upper: 36 },
    ] },
  { name: 'RDW', unit: '%', decimals: 1, ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 11.5, upper: 14.5 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 11.5, upper: 14.5 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 11.5, upper: 14.5 },
      { sex: 'ambos', a0: 12, a1: 18, lower: 11.5, upper: 14.5 },
      { sex: 'ambos', a0: 18, a1: 65, lower: 11.5, upper: 14.5 },
      { sex: 'ambos', a0: 65, a1: 120, lower: 11.5, upper: 14.5 },
    ] },
  { name: 'Plaquetas', unit: 'x10^3/µL', decimals: 0, ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 150, upper: 450 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 180, upper: 450 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 150, upper: 450 },
      { sex: 'ambos', a0: 12, a1: 18, lower: 150, upper: 400 },
      { sex: 'ambos', a0: 18, a1: 65, lower: 150, upper: 400 },
      { sex: 'ambos', a0: 65, a1: 120, lower: 150, upper: 400 },
    ] },
  { name: 'VMP', unit: 'fL', decimals: 1, ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 7, upper: 11 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 7, upper: 11 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 7, upper: 11 },
      { sex: 'ambos', a0: 12, a1: 18, lower: 7, upper: 11 },
      { sex: 'ambos', a0: 18, a1: 65, lower: 7, upper: 11 },
      { sex: 'ambos', a0: 65, a1: 120, lower: 7, upper: 11 },
    ] },
  { name: 'Leucocitos Totales', unit: 'x10^3/µL', decimals: 1, ranges: [
      { sex: 'ambos', a0: 0, a1: 1, lower: 9, upper: 30 },
      { sex: 'ambos', a0: 1, a1: 2, lower: 6, upper: 17 },
      { sex: 'ambos', a0: 2, a1: 12, lower: 5, upper: 14.5 },
      { sex: 'ambos', a0: 12, a1: 18, lower: 4.5, upper: 13 },
      { sex: 'ambos', a0: 18, a1: 65, lower: 4, upper: 11 },
      { sex: 'ambos', a0: 65, a1: 120, lower: 3.5, upper: 11 },
    ] },
  // Diferencial con rangos exactos provistos (unidad %, decimales 0)
  ...['Neutrófilos Segmentados','Neutrófilos Banda','Linfocitos','Monocitos','Eosinófilos','Basófilos','Blastos','Metamielocitos','Mielocitos','Promielocitos']
    .map(name => ({ name, unit: '%', decimals: 0, ranges: diffRanges(name) })),
];

function fmtRange(r){
  return `${r.sex} ${r.a0}-${r.a1} años: ${r.lower}..${r.upper}`;
}

function toCanonicalSex(s){
  const v = String(s || '').trim().toLowerCase();
  if (v === 'm' || v === 'masculino' || v === 'male') return 'Masculino';
  if (v === 'f' || v === 'femenino' || v === 'female') return 'Femenino';
  return 'Ambos';
}

async function ensureParameterExistsByNameLike(client, name, unit, decimals, apply){
  const patterns = [name, `%${name}%`];
  const { rows: existing } = await client.query('SELECT id,name FROM analysis_parameters WHERE name ILIKE ANY($1)', [patterns]);
  if (existing.length) return existing.map(r => r.id);
  const { rows: analyses } = await client.query(
    `SELECT id,name FROM analysis WHERE name ILIKE ANY($1)
     ORDER BY CASE WHEN LOWER(name) LIKE '%biometría%' THEN 0 WHEN LOWER(name) LIKE '%hemograma%' THEN 1 ELSE 2 END, name`
  , [[ '%Biometría Hemática%', '%Hemograma%' ]]);
  if (!analyses.length) return [];
  if (!apply) return [];
  const createdIds = [];
  for (const a of analyses){
    const { rows } = await client.query(
      `INSERT INTO analysis_parameters(analysis_id,name,unit,decimal_places)
       VALUES($1,$2,$3,$4) RETURNING id`, [a.id, name, unit, decimals]
    );
    createdIds.push(rows[0].id);
    console.log(`[BH:SET]   creado parámetro '${name}' en análisis '${a.name}'`);
  }
  return createdIds;
}

async function run(){
  const apply = process.argv.includes('--apply') || process.argv.includes('--write');
  const client = await pool.connect();
  try {
    console.log(`[BH:SET] Iniciando ${apply ? 'APPLY' : 'DRY-RUN'}`);
    await client.query('BEGIN');
    let totalParams = 0, totalRanges = 0;
    for (const spec of SPECS){
      // Construir patrones de búsqueda por sinónimos (ILIKE ANY)
      const syns = (ALIASES[spec.name] || [spec.name])
        .map(s => s.replace(/%/g,'').trim())
        .filter(Boolean)
        .map(s => s.includes('%') ? s : s); // permitir patrones ya con % si alguien añade
      // Añadir versiones con comodines para frases largas
      const patterns = Array.from(new Set([
        ...syns,
        ...syns.map(s => s.length > 3 ? `%${s}%` : s)
      ]));
      const { rows: params } = await client.query(
        'SELECT id,name,unit,decimal_places FROM analysis_parameters WHERE name ILIKE ANY($1)', [patterns]
      );
      if (!params.length){
        // Intentar crear si es un parámetro típico de BH
        const creatable = ['VMP','Neutrófilos Segmentados','Neutrófilos Banda','Linfocitos','Monocitos','Eosinófilos','Basófilos','Blastos','Metamielocitos','Mielocitos','Promielocitos'];
        if (creatable.includes(spec.name)){
          const created = await ensureParameterExistsByNameLike(client, spec.name, spec.unit, spec.decimals, apply);
          if (created.length){
            // Reconsultar
            const { rows: again } = await client.query(
              'SELECT id,name,unit,decimal_places FROM analysis_parameters WHERE id = ANY($1::uuid[])', [created]
            );
            params.push(...again);
          }
        }
        if (!params.length){
          console.warn(`[BH:SET] AVISO: parámetro no encontrado: ${spec.name}. Sinónimos probados=${patterns.join(', ')}`);
          continue;
        }
      }
      for (const p of params){
        totalParams++;
        // Unidad y decimales
        if (apply){
          await client.query('UPDATE analysis_parameters SET unit=$1, decimal_places=$2 WHERE id=$3', [spec.unit, spec.decimals, p.id]);
        }
        console.log(`[BH:SET] ${spec.name} -> unit=${spec.unit} dec=${spec.decimals}`);
        // Reemplazar rangos
        const { rowCount: existing } = await client.query('SELECT 1 FROM reference_ranges WHERE parameter_id=$1', [p.id]);
        console.log(`[BH:SET]   rangos existentes: ${existing}`);
        if (apply){
          await client.query('DELETE FROM reference_ranges WHERE parameter_id=$1', [p.id]);
        }
        for (const r of spec.ranges){
          totalRanges++;
          console.log(`  ${fmtRange(r)}`);
          if (apply){
            await client.query(
              `INSERT INTO reference_ranges(parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, text_value)
               VALUES ($1,$2,$3,$4,'años',$5,$6,NULL)`,
              [p.id, toCanonicalSex(r.sex), r.a0, r.a1, r.lower, r.upper]
            );
          }
        }
      }
    }
    if (apply) await client.query('COMMIT'); else await client.query('ROLLBACK');
    console.log(`[BH:SET] Finalizado. Parámetros procesados=${totalParams} rangos considerados=${totalRanges}.`);
  } catch (e){
    await client.query('ROLLBACK');
    console.error('[BH:SET] ERROR', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
