import { describe, test, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * Verifica formateo decimalPlaces en valores numéricos.
 */

describe('ReferenceValueSummary decimal formatting', () => {
  test('aplica toFixed(decimalPlaces) cuando se pasa prop', () => {
    const ranges = [
      { sexo:'Ambos', edadMin:0, edadMax:1, valorMin:0.2, valorMax:0.5 },
      { sexo:'Femenino', edadMin:12, edadMax:120, valorMin:0.5, valorMax:1.0 },
      { sexo:'Masculino', edadMin:12, edadMax:120, valorMin:0.6, valorMax:1.2 }
    ];
    const { container } = render(<ReferenceValueSummary values={ranges} decimalPlaces={2} />);
    const lines = Array.from(container.querySelectorAll('span'))
      .map(n => n.textContent)
      .filter(t => /\(.*años\):/.test(t));

    // Debe formatear con dos decimales
    expect(lines).toContain('(Ambos, 0-1 años): 0.20 - 0.50');
    // No colapsa porque valores difieren F/M
    const female = lines.find(l => l.startsWith('(F, 12-120 años):'));
    const male = lines.find(l => l.startsWith('(M, 12-120 años):'));
    expect(female).toMatch(/0.50 - 1.00/);
    expect(male).toMatch(/0.60 - 1.20/);
  });
});
