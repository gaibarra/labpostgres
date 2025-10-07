import { describe, test, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * Verifica que múltiples segmentos placeholder (sin datos reales) se colapsan en una sola línea
 * para parámetros canónicos generados inicialmente con full cobertura vacía.
 */

describe('ReferenceValueSummary placeholder collapse', () => {
  test('mantiene segmentación canónica de placeholders (6 líneas)', () => {
    const placeholders = [
      { sexo:'Ambos', edadMin:0, edadMax:1, valorMin:null, valorMax:null, notas:'Sin referencia establecida' },
      { sexo:'Ambos', edadMin:1, edadMax:2, valorMin:null, valorMax:null, notas:'Sin referencia establecida' },
      { sexo:'Ambos', edadMin:2, edadMax:12, valorMin:null, valorMax:null, notas:'Sin referencia establecida' },
      { sexo:'Ambos', edadMin:12, edadMax:18, valorMin:null, valorMax:null, notas:'Sin referencia establecida' },
      { sexo:'Ambos', edadMin:18, edadMax:65, valorMin:null, valorMax:null, notas:'Sin referencia establecida' },
      { sexo:'Ambos', edadMin:65, edadMax:120, valorMin:null, valorMax:null, notas:'Sin referencia establecida' }
    ];
    const { container } = render(<ReferenceValueSummary values={placeholders} />);
    const lines = Array.from(container.querySelectorAll('span')).map(n=>n.textContent);
  // Debe mostrar los 6 tramos individuales
  expect(lines.length).toBe(6);
  expect(lines[0]).toMatch(/0-1/);
  expect(lines[5]).toMatch(/65-120/);
  });
});
