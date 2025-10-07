import { describe, test, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * Test Glucosa (Química Sanguínea) mostrando que:
 * - Se muestran exactamente los 3 tramos seed
 * - No aparece 'N/A'
 * - Se respeta el orden ascendente por edad
 * - No se colapsan indebidamente intervalos distintos aunque todos sean 'Ambos'
 */

describe('ReferenceValueSummary Glucosa (real ranges mode)', () => {
  test('renderiza correctamente los rangos seed sin N/A y en orden', () => {
    const glucosaRanges = [
      { sexo:'Ambos', edadMin:0, edadMax:2, valorMin:60, valorMax:110 },
      { sexo:'Ambos', edadMin:2, edadMax:12, valorMin:70, valorMax:105 },
      { sexo:'Ambos', edadMin:12, edadMax:120, valorMin:70, valorMax:99 }
    ];

    const { container } = render(<ReferenceValueSummary values={glucosaRanges} />);

    // Capturar todas las líneas (span) generadas
    const spans = Array.from(container.querySelectorAll('span'))
      .map(n => n.textContent)
      .filter(t => /\(.*años\):/.test(t));

    // Deben ser exactamente 3 (no más, no menos)
    expect(spans.length).toBe(3);

    // No debe existir 'N/A'
    expect(spans.some(t => /N\/A/.test(t))).toBe(false);

    // Verificar contenido exacto de cada tramo
    const expected = [
      '(Ambos, 0-2 años): 60 - 110',
      '(Ambos, 2-12 años): 70 - 105',
      '(Ambos, 12-120 años): 70 - 99'
    ];
    expected.forEach(exp => {
      expect(spans).toContain(exp);
    });

    // Verificar orden ascendente por edadMin
    const extractAgeMin = (line) => {
      const m = line.match(/, (\d+)-/); // toma el primer número después de la coma
      return m ? parseInt(m[1],10) : -1;
    };
    const mins = spans.map(extractAgeMin);
    const sorted = [...mins].sort((a,b)=>a-b);
    expect(mins).toEqual(sorted);
  });
});
