import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { within, fireEvent, waitFor } from '@testing-library/react';
import { renderNoStrict } from '../../../../../test-utils/renderNoStrict';
import StudyParameters from '../StudyParameters.jsx';

// Mock dialog to avoid Radix portal complexity
vi.mock('../ParameterEditDialog', () => ({ default: () => null }));
vi.mock('../ReferenceValueSummary', () => ({ default: () => <div /> }));

const mockParameters = [
  { id: 'p1', name: 'Param1', group: 'G1', unit: 'u1', valorReferencia: [] },
  { id: 'p2', name: 'Param2', group: 'G1', unit: 'u2', valorReferencia: [] },
];

describe('StudyParameters delete does not trigger cross-render setState warning', () => {
  let onParametersChange;
  let originalError;
  let originalWarn;
  const errorCalls = [];
  const warnCalls = [];

  beforeEach(() => {
    onParametersChange = vi.fn();
    errorCalls.length = 0;
    warnCalls.length = 0;
    originalError = console.error;
    originalWarn = console.warn;
    console.error = (...args) => { errorCalls.push(args.join(' ')); originalError.apply(console, args); };
    console.warn = (...args) => { warnCalls.push(args.join(' ')); originalWarn.apply(console, args); };
  });

  it('elimina sin emitir el warning React de setState cruzado', async () => {
    const { container } = renderNoStrict(<StudyParameters parameters={mockParameters} onParametersChange={onParametersChange} isSubmitting={false} />);
    const tables = container.querySelectorAll('table');
    const table = tables[tables.length - 1];
    const deleteButtons = within(table).getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(onParametersChange).toHaveBeenCalled());

    // Verificar que no apareció el warning específico
    const hasCrossRenderWarning = errorCalls.concat(warnCalls).some(m => m.includes('Cannot update a component') && m.includes('while rendering a different component'));
    expect(hasCrossRenderWarning).toBe(false);
  });

  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });
});
