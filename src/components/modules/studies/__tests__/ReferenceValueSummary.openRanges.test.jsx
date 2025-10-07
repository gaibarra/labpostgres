import { describe, test, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * Verifica que rangos abiertos (solo lower o solo upper) y texto se muestren.
 * También que se oculte un placeholder completamente vacío.
 */

describe('ReferenceValueSummary open ranges & partials', () => {
  test('muestra lower-only, upper-only y texto; oculta placeholder', () => {
    const ranges = [
      // Placeholder puro (debe ocultarse)
      { sexo:'Ambos', edadMin:0, edadMax:120, valorMin:null, valorMax:null, notas:'Sin referencia establecida' },
      // Solo lower
      { sexo:'Ambos', edadMin:0, edadMax:120, valorMin:50, valorMax:null },
      // Solo upper
      { sexo:'Ambos', edadMin:0, edadMax:120, valorMin:null, valorMax:99 },
      // Texto permitido
      { sexo:'Ambos', edadMin:0, edadMax:120, textoPermitido:'Negativo' }
    ];

    const { container } = render(<ReferenceValueSummary values={ranges} />);

    const lines = Array.from(container.querySelectorAll('span'))
      .map(n => n.textContent)
      .filter(t => t && t.includes('('));

    // Esperamos 3 líneas (placeholder oculto)
    expect(lines.length).toBe(3);
    expect(lines.some(l => l.includes('>= 50'))).toBe(true);
    expect(lines.some(l => l.includes('<= 99'))).toBe(true);
    expect(lines.some(l => /Negativo/.test(l))).toBe(true);
  });
});
