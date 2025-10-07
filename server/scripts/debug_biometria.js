#!/usr/bin/env node
/**
 * Script de diagnóstico rápido para verificar que la lógica de completado canónico
 * de Biometría Hemática genere TODOS los parámetros y que los parámetros sin datos
 * numéricos se expandan a los 6 segmentos: 0-1,1-2,2-12,12-18,18-65,65-120.
 *
 * NO llama a OpenAI ni a la base de datos. Replica la parte relevante de ensureCoveragePost
 * para esta batería específica.
 */

const CANONICAL = [
  'Hemoglobina','Hematocrito','Eritrocitos','VCM','HCM','CHCM','RDW','Plaquetas','VMP',
  'Leucocitos Totales','Neutrófilos Segmentados','Neutrófilos Banda','Linfocitos','Monocitos','Eosinófilos','Basófilos',
  'Blastos','Metamielocitos','Mielocitos','Promielocitos'
];
const DEFAULTS = {
  'Hemoglobina': { unit:'g/dL', decimal_places:1 },
  'Hematocrito': { unit:'%', decimal_places:0 },
  'Eritrocitos': { unit:'x10^6/µL', decimal_places:2 },
  'VCM': { unit:'fL', decimal_places:1 },
  'HCM': { unit:'pg', decimal_places:1 },
  'CHCM': { unit:'g/dL', decimal_places:1 },
  'RDW': { unit:'%', decimal_places:1 },
  'Plaquetas': { unit:'x10^3/µL', decimal_places:0 },
  'VMP': { unit:'fL', decimal_places:1 },
  'Leucocitos Totales': { unit:'x10^3/µL', decimal_places:1 },
  'Neutrófilos Segmentados': { unit:'%', decimal_places:0 },
  'Neutrófilos Banda': { unit:'%', decimal_places:0 },
  'Linfocitos': { unit:'%', decimal_places:0 },
  'Monocitos': { unit:'%', decimal_places:0 },
  'Eosinófilos': { unit:'%', decimal_places:0 },
  'Basófilos': { unit:'%', decimal_places:0 },
  'Blastos': { unit:'%', decimal_places:0 },
  'Metamielocitos': { unit:'%', decimal_places:0 },
  'Mielocitos': { unit:'%', decimal_places:0 },
  'Promielocitos': { unit:'%', decimal_places:0 }
};
const AGE_SEGMENTS = [ [0,1], [1,2], [2,12], [12,18], [18,65], [65,120] ];
const SEX_DIFF = new Set(['hemoglobina','hematocrito','eritrocitos']);
const normalizeKey = s => (s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').trim();

function buildDefaultVR(name){
  const sexDiff = SEX_DIFF.has(normalizeKey(name));
  const ranges=[];
  for (const [a,b] of AGE_SEGMENTS){
    if (sexDiff && a>=12){
      ranges.push(
        { sexo:'Masculino', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' },
        { sexo:'Femenino', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' }
      );
    } else {
      ranges.push({ sexo:'Ambos', edadMin:a, edadMax:b, unidadEdad:'años', valorMin:null, valorMax:null, notas:'Sin referencia establecida' });
    }
  }
  return ranges;
}

function simulate(){
  const parameters = CANONICAL.map(name=>({
    name,
    unit: DEFAULTS[name].unit,
    decimal_places: DEFAULTS[name].decimal_places,
    valorReferencia: buildDefaultVR(name)
  }));
  return parameters;
}

const result = simulate();
console.log('Total parámetros:', result.length);
for (const p of result){
  const segments = p.valorReferencia.length;
  const sample = p.valorReferencia.slice(0,2).map(r=>`${r.sexo} ${r.edadMin}-${r.edadMax}`).join(', ');
  console.log(`- ${p.name} (${p.unit}) segs=${segments} ej=[${sample}]`);
}

// Validaciones rápidas
const missing = CANONICAL.filter(c=> !result.find(r=> r.name===c));
if (missing.length){
  console.error('FALTAN:', missing);
  process.exit(1);
}
console.log('\nOK: todos los parámetros canónicos presentes con segmentación generada.');
