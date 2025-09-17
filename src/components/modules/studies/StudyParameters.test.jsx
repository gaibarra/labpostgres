import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderNoStrict } from '../../../../test-utils/renderNoStrict';
import { describe, it, expect, beforeEach, vi } from 'vitest';
// matchers already registered globally in setupTests; avoid duplicate extend causing TypeError
import StudyParameters from './StudyParameters';

// Mock child components to isolate the tests
// Mock dialog (minimal) to prevent portal / Radix side-effects
vi.mock('./ParameterEditDialog', () => ({ default: () => null }));

vi.mock('./ReferenceValueSummary', () => ({
  default: ({ values }) => <div data-testid="ref-value-summary">{JSON.stringify(values)}</div>,
}));

const mockParameters = [
  { id: 'p1', name: 'Hemoglobina', group: 'Hematología', unit: 'g/dL', valorReferencia: [] },
  { id: 'p2', name: 'Glucosa', group: 'Química Clínica', unit: 'mg/dL', valorReferencia: [] },
  { id: 'p3', name: 'Leucocitos', group: 'Hematología', unit: 'x10^3/μL', valorReferencia: [] },
];

describe('StudyParameters (updated UI)', () => {
  let onParametersChange;

  beforeEach(() => {
    onParametersChange = vi.fn();
  });

  it('muestra estado vacío', () => {
    render(<StudyParameters parameters={[]} onParametersChange={onParametersChange} isSubmitting={false} />);
    expect(screen.getByText(/aún no se han añadido parámetros/i)).toBeTruthy();
  });

  it('renderiza parámetros en filas', () => {
    render(<StudyParameters parameters={mockParameters} onParametersChange={onParametersChange} isSubmitting={false} />);
  expect(screen.getAllByText('Hemoglobina').length).toBeGreaterThan(0);
  });

  // Dialog add/edit covered en pruebas específicas de guardado inmediato

  // Edit dialog interaction reducido aquí para estabilidad

    it('elimina parámetro llama callback', async () => {
  const { container } = renderNoStrict(<StudyParameters parameters={mockParameters} onParametersChange={onParametersChange} isSubmitting={false} />);
      const tables = container.querySelectorAll('table');
      const table = tables[tables.length - 1];
      const deleteButtons = within(table).getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);
      await waitFor(() => expect(onParametersChange).toHaveBeenCalled());
    });

  // Save via dialog tested en suite de guardado inmediato

  // Test de reorden eliminado (flechas removidas)
});
