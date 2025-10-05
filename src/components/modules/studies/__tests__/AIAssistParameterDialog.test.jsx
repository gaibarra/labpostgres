import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIAssistParameterDialog from '../AIAssistParameterDialog.jsx';

/**
 * Nueva UX:
 * - Campo único de nombre + botón "Sugerir nombre" (usa endpoint existente internamente)
 * - Aceptar habilitado si nombre >= 2 chars y no duplicado
 * - Manejo de error de sugerencia no bloquea aceptación manual
 */

describe('AIAssistParameterDialog', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const baseProps = {
    isOpen: true,
    onOpenChange: vi.fn(),
    studyId: 'study-1',
    studyName: 'Perfil Tiroideo',
    existingParameters: ['TSH'],
  };

  it('deshabilita Aceptar con nombre vacío y lo habilita al escribir', () => {
    render(<AIAssistParameterDialog {...baseProps} />);
    const acceptBtn = screen.getByRole('button', { name: /aceptar/i });
    expect(acceptBtn).toBeDisabled();
    const nameInput = screen.getByPlaceholderText(/índice inflamatorio tiroideo/i);
    fireEvent.change(nameInput, { target: { value: 'Indice X' } });
    expect(acceptBtn).not.toBeDisabled();
  });

  it('sugiere nombre y luego acepta', async () => {
    const onAccept = vi.fn();
    const mockParam = {
      name: 'Indice Inflamatorio Tiroideo',
      unit: 'UI/mL',
      reference_ranges: [
        { sex: 'Ambos', lower: 0.5, upper: 2.5, age_min: null, age_max: null, age_min_unit: null, text_value: null }
      ],
      notes: 'Generado de prueba'
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ parameter: mockParam }) });
    render(<AIAssistParameterDialog {...baseProps} onAccept={onAccept} />);
    const suggestBtn = screen.getByRole('button', { name: /sugerir nombre/i });
    fireEvent.click(suggestBtn);
    await waitFor(()=> expect(global.fetch).toHaveBeenCalled());
    // Nombre llenado
    await waitFor(()=> expect(screen.getByDisplayValue(/indice inflamatorio tiroideo/i)).toBeInTheDocument());
    const acceptBtn = screen.getByRole('button', { name: /aceptar/i });
    fireEvent.click(acceptBtn);
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0]).toMatchObject({ name: mockParam.name });
  });
  it('muestra error de sugerencia pero permite aceptar manualmente', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' });
    render(<AIAssistParameterDialog {...baseProps} />);
    const suggestBtn = screen.getByRole('button', { name: /sugerir nombre/i });
    fireEvent.click(suggestBtn);
    await waitFor(()=> expect(global.fetch).toHaveBeenCalled());
    await waitFor(()=> expect(screen.getByText(/http 400/i)).toBeInTheDocument());
  const nameInputs = screen.getAllByPlaceholderText(/índice inflamatorio tiroideo/i);
  // Tomamos el último (puede haber restos de diálogos previos si Radix duplicó temporalmente durante animación)
  const nameInput = nameInputs[nameInputs.length - 1];
  fireEvent.change(nameInput, { target: { value: 'Parametro Manual X' } });
    const acceptBtn = screen.getByRole('button', { name: /aceptar/i });
    expect(acceptBtn).not.toBeDisabled();
  });
});
