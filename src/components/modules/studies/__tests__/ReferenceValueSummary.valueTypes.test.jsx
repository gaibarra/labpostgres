import { describe, test, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ReferenceValueSummary from '../ReferenceValueSummary.jsx';

/**
 * Cubre ramas tipoValor:
 * - alfanumerico (textoPermitido)
 * - textoLibre (truncado a 25 + …)
 * - numerico sin min/max => ahora se OCULTA (ya no muestra N/A)
 */

describe('ReferenceValueSummary value type branches', () => {
  test('alfanumérico y textoLibre y numerico vacío', () => {
    const ranges = [
      { sexo:'Ambos', edadMin:0, edadMax:10, textoPermitido:'Negativo / Positivo', tipoValor:'alfanumerico' },
      { sexo:'Ambos', edadMin:10, edadMax:20, textoLibre:'Valor descriptivo muy largo que debe truncarse en la interfaz para no romper layout', tipoValor:'textoLibre' },
  { sexo:'Ambos', edadMin:20, edadMax:30, tipoValor:'numerico' } // este debe ocultarse
    ];
    const { container } = render(<ReferenceValueSummary values={ranges} />);
    const lines = Array.from(container.querySelectorAll('span'))
      .map(n => n.textContent)
      .filter(t => /\(.*años\):/.test(t));

  // Solo 2 líneas porque el numérico vacío se oculta
  expect(lines.length).toBe(2);
    const alfanum = lines.find(l => l.includes('0-10 años') && l.includes('Negativo / Positivo'));
    expect(alfanum).toBeTruthy();

  const textoLibre = lines.find(l => l.includes('10-20 años'));
  expect(textoLibre).toBeTruthy();
  // Debe contener prefijo y terminar con elipsis …
  expect(textoLibre.includes('Valor descriptivo muy lar…')).toBe(true);
  expect(/…$/.test(textoLibre)).toBe(true);

    // Verificamos que NO aparece el tramo vacío 20-30 años
    const numericoHidden = lines.find(l => l.includes('20-30 años'));
    expect(numericoHidden).toBeFalsy();
  });
});
