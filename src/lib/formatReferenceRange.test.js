import { describe, it, expect } from 'vitest';
import { formatSingleRange, formatReferenceRangeList } from './formatReferenceRange';

describe('formatReferenceRange utils', () => {
  it('formatea rango completo', () => {
    expect(formatSingleRange({ valorMin:1, valorMax:3 })).toBe('1–3');
  });
  it('formatea solo lower', () => {
    expect(formatSingleRange({ lower:2 })).toBe('>=2');
  });
  it('formatea solo upper', () => {
    expect(formatSingleRange({ upper:5 })).toBe('<=5');
  });
  it('usa textoLibre si no hay números', () => {
    expect(formatSingleRange({ textoLibre:'Positivo' })).toBe('Positivo');
  });
  it('lista filtra nulos', () => {
    const list = [ { valorMin:1, valorMax:2 }, { }, { textoPermitido:'Alfa' } ];
    expect(formatReferenceRangeList(list)).toEqual(['1–2','Alfa']);
  });
});
