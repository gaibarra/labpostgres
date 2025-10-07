import { describe, test, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * Test Creatinina (sexos divergentes en adulto):
 * - Los tramos adulto Femenino y Masculino (12-120) NO deben colapsar porque difieren en valores.
 * - Se preservan ambos.
 * - Orden ascendente correcto.
 */

describe('ReferenceValueSummary Creatinina sex divergence', () => {
  test('mantiene F y M separados cuando difieren valores', () => {
    const creatininaRanges = [
      { sexo:'Ambos', edadMin:0, edadMax:1, valorMin:0.20, valorMax:0.50 },
      { sexo:'Ambos', edadMin:1, edadMax:12, valorMin:0.30, valorMax:0.70 },
      { sexo:'Femenino', edadMin:12, edadMax:120, valorMin:0.50, valorMax:1.00 },
      { sexo:'Masculino', edadMin:12, edadMax:120, valorMin:0.60, valorMax:1.20 }
    ];

    const { container } = render(<ReferenceValueSummary values={creatininaRanges} />);
    const lines = Array.from(container.querySelectorAll('span'))
      .map(n => n.textContent)
      .filter(t => /\(.*años\):/.test(t));

    // Debemos tener 4 líneas (no colapso en 12-120)
    expect(lines.length).toBe(4);

    // Asegurar que existen líneas separadas para F y M en 12-120
  const femaleLine = lines.find(l => l.startsWith('(F, 12-120 años): 0.5 - 1'));
  const maleLine = lines.find(l => l.startsWith('(M, 12-120 años): 0.6 - 1.2'));
    expect(femaleLine).toBeTruthy();
    expect(maleLine).toBeTruthy();

    // Confirmar que NO hay versión colapsada '(Ambos, 12-120 años): 0.50 - 1.20'
  const collapsed = lines.some(l => l.startsWith('(Ambos, 12-120 años):'));
    expect(collapsed).toBe(false);

    // Orden
    const expectedStarts = [
      '(Ambos, 0-1 años):',
      '(Ambos, 1-12 años):',
    ];
    expectedStarts.forEach(prefix => {
      expect(lines.some(l => l.startsWith(prefix))).toBe(true);
    });
  });
});
