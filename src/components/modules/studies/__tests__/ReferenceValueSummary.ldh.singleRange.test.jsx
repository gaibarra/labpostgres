import { describe, test, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * LDH tiene un solo tramo en seed (12-120, Ambos 140-280)
 */

describe('ReferenceValueSummary LDH single range', () => {
  test('renderiza un único tramo correctamente', () => {
    const ldhRanges = [
      { sexo:'Ambos', edadMin:12, edadMax:120, valorMin:140, valorMax:280 }
    ];
    const { container } = render(<ReferenceValueSummary values={ldhRanges} />);
    const lines = Array.from(container.querySelectorAll('span'))
      .map(n => n.textContent)
      .filter(t => /\(.*años\):/.test(t));
    expect(lines).toEqual(['(Ambos, 12-120 años): 140 - 280']);
  });
});
