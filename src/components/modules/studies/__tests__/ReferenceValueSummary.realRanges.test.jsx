import { describe, test, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * Verifica modo B: mostrar rangos reales sin buckets artificiales.
 */

describe('ReferenceValueSummary (real ranges mode)', () => {
  test('muestra exactamente los rangos reales VCM seed sin N/A', () => {
    const ranges = [
      { sexo:'Ambos', edadMin:0, edadMax:1, valorMin:84, valorMax:106 },
      { sexo:'Ambos', edadMin:1, edadMax:2, valorMin:72, valorMax:84 },
      { sexo:'Ambos', edadMin:2, edadMax:12, valorMin:76, valorMax:90 },
      { sexo:'Ambos', edadMin:12, edadMax:18, valorMin:78, valorMax:95 },
      { sexo:'Femenino', edadMin:18, edadMax:120, valorMin:80, valorMax:96 },
      { sexo:'Masculino', edadMin:18, edadMax:120, valorMin:80, valorMax:96 }
    ];
    render(<ReferenceValueSummary values={ranges} />);
    const texts = screen.getAllByText(/\(/).map(n=>n.textContent);
    // No debe haber 'N/A'
    expect(texts.some(t=>/N\/A/.test(t))).toBe(false);
    // Debe contener al menos la representación de 0-1 y 12-18
    expect(texts.some(t=>t.includes('(A, 0-1 años):') || t.includes('(Ambos, 0-1 años):'))).toBe(true);
    expect(texts.some(t=>t.includes('12-18 años'))).toBe(true);
    // Debe colapsar sexo F/M idénticos a Ambos (nuestro colapso produce un único tramo 18-120 Ambos) o mostrar ambos si no colapsa.
    // Verificamos representación del tramo 18-120 (colapsado a Ambos o separado F/M).
    const segmentLines = texts.filter(t=> t.includes('18-120'));
      const hasCollapsed = segmentLines.some(t=> /(\(A[,)]|\(Ambos,)/.test(t));
  const hasSeparate = segmentLines.length >= 2 && segmentLines.some(t=>/\(F[,)]/.test(t)) && segmentLines.some(t=>/\(M[,)]/.test(t));
    if (!(hasCollapsed || hasSeparate)) {
      throw new Error('No se encontró representación válida para 18-120. Capturado: '+ JSON.stringify(segmentLines));
    }
  });
});
