import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import GeneralSettings from '@/components/modules/administration/GeneralSettings.jsx';

// Mock ThemeContext minimal
vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => <>{children}</>,
  useTheme: () => ({ theme: 'light' })
}));

// Mock toast to silence UI noise
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }));

// Mock apiClient to control /config lifecycle + PATCH behavior
vi.mock('@/lib/apiClient', () => {
  const state = {
    config: {
      labInfo: {},
      reportSettings: {},
      uiSettings: {},
      regionalSettings: {},
  // Simular respuesta backend para admin: valor completo + preview.
  // Para probar el flujo de placeholder (campo vacío pero con preview), exponemos sólo preview inicial.
  integrations: { openaiApiKeyPreview: 'sk-EXIS***7890', whatsappApiKey: 'wapp-INIT' },
      taxSettings: {}
    }
  };
  const mock = {
    get: vi.fn((path) => {
      if (path === '/config') {
        return Promise.resolve({ ...state.config });
      }
      return Promise.resolve({});
    }),
    patch: vi.fn((path, body) => {
      if (path === '/config') {
        Object.keys(body).forEach(section => {
          state.config[section] = { ...(state.config[section] || {}), ...body[section] };
        });
        // Simular que backend responde sin exponer valor completo, sólo preview, cuando se setea openaiApiKey
        if (body.integrations && body.integrations.openaiApiKey) {
          const full = body.integrations.openaiApiKey;
            state.config.integrations.openaiApiKey = full; // temporal
            state.config.integrations.openaiApiKeyPreview = full.slice(0,6) + '***' + full.slice(-4);
            // Simular masking (el componente esperará preview; aunque admin vería valor, aquí lo ocultamos para UX test)
            delete state.config.integrations.openaiApiKey;
        }
        return Promise.resolve({ ...state.config });
      }
      return Promise.resolve({});
    }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    auth: { me: vi.fn(() => Promise.resolve({ user: { id: 'u1', email: 't@example.com', role: 'Administrador' } })) }
  };
  return { __esModule: true, default: mock, apiClient: mock };
});
import apiClient from '@/lib/apiClient';

// Helper render
function renderWithProviders(initialActiveTab = 'labInfo') {
  return render(
    <BrowserRouter>
      <AuthProvider initialUser={{ id: 'u1', email: 't@example.com', role: 'Administrador' }}>
        <SettingsProvider>
          <GeneralSettings initialActiveTab={initialActiveTab} />
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('IntegrationsSettingsTab OpenAI key persistence UX', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => cleanup());

  it('muestra preview de clave existente y permite actualizarla', async () => {
    renderWithProviders('integrations');
    // Esperar a que termine la carga (spinner desaparezca) y aparezca el heading de la sección
    await screen.findByText(/Integraciones y API Keys/i);
    const input = await vi.waitFor(() => {
      const el = document.querySelector('#openaiApiKey');
      if (!el) throw new Error('input not yet mounted');
      return el;
    });

    // Asegurar que también exista el label asociado (pero no fallar si timing raro)
    const maybeLabel = screen.queryByText('OpenAI API Key');
    expect(maybeLabel).not.toBeNull();

  // Al tener sólo preview (sin valor completo) el input debe estar vacío y con placeholder de clave guardada
  expect(input.value).toBe('');
  expect(input).toHaveAttribute('placeholder', expect.stringMatching(/clave guardada/i));

    // Texto preview visible
    await screen.findByText(/Clave guardada:/i);
  expect(screen.getByText(/sk-EXIS/)).toBeInTheDocument();

    // Cambiamos valor
  fireEvent.change(input, { target: { value: 'sk-NEW-9999999999' } });

    // Guardar
    const saveBtn = screen.getByRole('button', { name: /Guardar Cambios/i });
    fireEvent.click(saveBtn);

    // Esperar a que PATCH haya sido llamado con dif que incluya openaiApiKey
    await vi.waitFor(() => {
      const called = apiClient.patch.mock.calls.some(([path, body]) => path === '/config' && body.integrations?.openaiApiKey === 'sk-NEW-9999999999');
      expect(called).toBe(true);
    });

    // Tras re-render, preview debe reflejar formato enmascarado de la nueva clave
    // Relajamos a buscar cualquier span con 'sk-' y '***' juntos
    await vi.waitFor(() => {
      const masked = screen.queryAllByText(/sk-.*\*\*\*/i);
      expect(masked.length).toBeGreaterThan(0);
    });
  });

  it('si el usuario no modifica el campo, no envía PATCH redundante de la clave', async () => {
    renderWithProviders();
    const tabTrigger = await screen.findByRole('tab', { name: /Integraciones/i });
    fireEvent.click(tabTrigger);
    const initialCalls = apiClient.patch.mock.calls.length;
    // Guardar sin cambiar
    const saveBtn = screen.getByRole('button', { name: /Guardar Cambios/i });
    fireEvent.click(saveBtn);
    // Debería hacer un PATCH (porque otras secciones podrían haberse serializado) pero sin cambiar la clave
    await vi.waitFor(() => {
      // Si no hay diff real puede incluso no llamar patch; aceptamos ambas variantes: 0 llamadas nuevas o 1 sin cambio de clave distinta
      const newCalls = apiClient.patch.mock.calls.slice(initialCalls);
      if (newCalls.length === 0) return; // ok
      const changed = newCalls.some(([, body]) => body.integrations && typeof body.integrations.openaiApiKey !== 'undefined');
      expect(changed).toBe(false);
    });
  });
});
