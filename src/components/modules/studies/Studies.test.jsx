
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/apiClient';
import { SWRConfig } from 'swr';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppDataProvider } from '@/contexts/AppDataContext';
import Studies from '@/components/modules/Studies';

// Mock ParameterEditDialog to auto-save a parameter when opened
vi.mock('./ParameterEditDialog', () => ({
  default: ({ isOpen, onSave }) => isOpen ? (
    <div>
      <button onClick={() => onSave({ tempId: 'auto1', name: 'Colesterol Total', unit: 'mg/dL', decimal_places: 0, valorReferencia: [] })}>Guardar Parámetro</button>
    </div>
  ) : null
}));

const renderWithProviders = (ui) => {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <AuthProvider>
        <AppDataProvider>
          {ui}
        </AppDataProvider>
      </AuthProvider>
    </SWRConfig>
  );
};

describe('Studies Component (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom no implementa matchMedia; mock básico
    if (!window.matchMedia) {
      window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });
    }
  });

  it('crea nuevo estudio y añade parámetro inmediato', async () => {
    renderWithProviders(<Studies />);

  // Con el mock actual, la carga puede ser inmediata o diferida; sólo esperar a que spinner desaparezca
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 1500 }).catch(()=>{});

    // Abrir formulario de nuevo estudio
    fireEvent.click(screen.getByRole('button', { name: /nuevo estudio/i }));

  await waitFor(() => expect(screen.getByText(/registrar nuevo estudio/i)).toBeInTheDocument());

    // Rellenar campos básicos del estudio
    fireEvent.change(screen.getByLabelText(/nombre del estudio/i), { target: { value: 'Perfil Lipídico' } });
    fireEvent.change(screen.getByLabelText(/descripción/i), { target: { value: 'Perfil completo de lípidos' } });

  // Añadir parámetro (mock dialog auto-save button)
  fireEvent.click(screen.getByRole('button', { name: /añadir parámetro/i }));
  fireEvent.click(screen.getByRole('button', { name: /guardar parámetro/i }));

  // El diálogo se cierra al guardar; permitimos pequeño retraso
  await waitFor(() => expect(screen.getByText('Colesterol Total')).toBeInTheDocument());

    // Guardar estudio (crear)
    fireEvent.click(screen.getByRole('button', { name: /guardar estudio/i }));

    // Verifica que se haya realizado POST a /analysis (creación)
    const postSpy = vi.spyOn(apiClient, 'post');
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/analysis', expect.any(Object));
    });
  });
});
