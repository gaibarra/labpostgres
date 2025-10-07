import { describe, test, expect } from 'vitest';
import { toValorReferencia } from '../AIAssistParameterDialog.jsx';

/*
Casos cubiertos:
1. Vacío -> placeholders (6 segmentos) sexo Ambos
2. Un rango Ambos sin edades (edadMin/Max null) -> segmentación fallback completa
3. Rangos Masculino con hueco -> rellena gap y completa hasta 120
4. Rangos diferenciados por sexo (M/F) parcialmente definidos -> cada sexo se expande independiente
*/

describe('toValorReferencia', () => {
  test('retorna placeholders para entrada vacía', () => {
    const out = toValorReferencia([]);
    expect(out.length).toBeGreaterThanOrEqual(6);
    // Debe cubrir 0-1 y 65-120 al menos
    const hasFirst = out.some(r=> r.edadMin===0 && r.edadMax===1);
    const hasLast = out.some(r=> r.edadMin===65 && r.edadMax===120);
    expect(hasFirst && hasLast).toBe(true);
  });

  test('un único rango Ambos sin edades y sin valores numéricos -> 6 placeholders canónicos', () => {
    const out = toValorReferencia([{ sex:'Ambos', age_min:null, age_max:null, lower:null, upper:null }]);
    expect(out.length).toBe(6);
    const spans = [[0,1],[1,2],[2,12],[12,18],[18,65],[65,120]];
    spans.forEach(([a,b])=>{
      expect(out.some(r=> r.edadMin===a && r.edadMax===b && r.valorMin==null && r.valorMax==null)).toBe(true);
    });
  });

  test('rellena huecos y completa cobertura para sexo único', () => {
    // Dos rangos dejando hueco 5-9 (ejemplo pequeño adaptado) - usaremos edades pequeñas para validar relleno
    const out = toValorReferencia([
      { sex:'Masculino', age_min:0, age_max:2, lower:1, upper:2 },
      { sex:'Masculino', age_min:10, age_max:12, lower:3, upper:4 }
    ]);
    // Debe insertar tramo 3-9 placeholder y luego 13-120 placeholder
    const gap = out.find(r=> r.edadMin===3 && r.edadMax===9 && r.valorMin==null && r.valorMax==null);
    const tail = out.find(r=> r.edadMin>12 && r.edadMax===120);
    expect(gap).toBeTruthy();
    expect(tail).toBeTruthy();
  });

  test('expande separadamente por sexo', () => {
    const out = toValorReferencia([
      { sex:'Masculino', age_min:0, age_max:1, lower:1, upper:2 },
      { sex:'Femenino', age_min:0, age_max:1, lower:1, upper:2 }
    ]);
    const maleTail = out.find(r=> r.sexo==='Masculino' && r.edadMax===120);
    const femaleTail = out.find(r=> r.sexo==='Femenino' && r.edadMax===120);
    expect(maleTail).toBeTruthy();
    expect(femaleTail).toBeTruthy();
  });
});
