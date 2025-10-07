import { describe, test, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * Test VCM:
 * - Orden ascendente por edad
 * - Colapso correcto de tramo adulto (18-120) F/M -> Ambos
 * - Valores exactos de cada segmento
 */

describe('ReferenceValueSummary VCM ordering + collapse', () => {
  test('ordena por edad y colapsa tramo adulto idéntico', () => {
    const vcmRanges = [
      { sexo:'Ambos', edadMin:2, edadMax:12, valorMin:76, valorMax:90 },
      { sexo:'Ambos', edadMin:12, edadMax:18, valorMin:78, valorMax:95 },
      { sexo:'Femenino', edadMin:18, edadMax:120, valorMin:80, valorMax:96 },
      { sexo:'Masculino', edadMin:18, edadMax:120, valorMin:80, valorMax:96 },
      { sexo:'Ambos', edadMin:0, edadMax:1, valorMin:84, valorMax:106 },
      { sexo:'Ambos', edadMin:1, edadMax:2, valorMin:72, valorMax:84 }
    ];

    const { container } = render(<ReferenceValueSummary values={vcmRanges} />);

    const lines = Array.from(container.querySelectorAll('span'))
      .map(n => n.textContent)
      .filter(t => /\(.*años\):/.test(t));

    // Esperamos 5 líneas finales (porque 18-120 se colapsa a una sola)
    expect(lines.length).toBe(5);

    // Verificar orden exacto esperado
    const expectedOrder = [
      '(Ambos, 0-1 años): 84 - 106',
      '(Ambos, 1-2 años): 72 - 84',
      '(Ambos, 2-12 años): 76 - 90',
      '(Ambos, 12-18 años): 78 - 95',
      '(Ambos, 18-120 años): 80 - 96'
    ];
    expect(lines).toEqual(expectedOrder);

    // Asegurar que no existen líneas separadas para F y M adultos
    const adultSeparateF = lines.some(l => /(F|Femenino).*, 18-120/.test(l));
    const adultSeparateM = lines.some(l => /(M|Masculino).*, 18-120/.test(l));
    expect(adultSeparateF || adultSeparateM).toBe(false);
  });
});
