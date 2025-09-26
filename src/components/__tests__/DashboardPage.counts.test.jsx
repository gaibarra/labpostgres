import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock ThemeContext para evitar efectos y llamadas a API de tema
vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => <>{children}</>,
  useTheme: () => ({ theme: 'light' })
}));

// Mock apiClient (default export + named)
vi.mock('@/lib/apiClient', () => {
  const mock = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    auth: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() }
  };
  return { __esModule: true, default: mock, apiClient: mock };
});

import apiClient from '@/lib/apiClient';
import DashboardPage from '@/pages/DashboardPage.jsx';

// Helper wrapper sin ThemeProvider real
const renderWithProviders = (ui) => render(
  <BrowserRouter>
    <AuthProvider initialUser={{ id: 'u1', email: 'test@example.com', profile: { role: 'admin', first_name: 'Test', last_name: 'User' } }}>
      {ui}
    </AuthProvider>
  </BrowserRouter>
);

describe('DashboardPage counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('usa el total del endpoint /count aunque la lista tenga menos items', async () => {
    // Respuestas encadenadas en el orden de Promise.all en DashboardPage
    // patients.count, analysis.count, packages.count, referrers.count, work-orders.count?since=YYYY-MM-DD, recent window, recent list
    apiClient.get.mockImplementation((path) => {
      if (path === '/patients/count') return Promise.resolve({ total: 42 });
      if (path === '/analysis/count') return Promise.resolve({ total: 10 });
      if (path === '/packages/count') return Promise.resolve({ total: 5 });
      if (path === '/referrers/count') return Promise.resolve({ total: 7 });
      if (path.startsWith('/work-orders/count')) return Promise.resolve({ total: 3 });
      if (path.startsWith('/work-orders/recent?window=30d')) return Promise.resolve([]);
      if (path.startsWith('/work-orders/recent?limit=5')) return Promise.resolve([]);
      // fallback list endpoints (not used but safe)
      if (path === '/patients') return Promise.resolve([]);
      if (path === '/analysis') return Promise.resolve({ data: [], page: { total: 0 } });
      if (path === '/packages') return Promise.resolve([]);
      if (path === '/referrers') return Promise.resolve([]);
      if (path.startsWith('/work-orders')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderWithProviders(<DashboardPage />);

    // Esperar título principal para asegurar render
    await screen.findByText(/Dashboard Principal/i);
    // Verificar cada valor
  expect(screen.getByTestId('stat-patients').textContent).toBe('42');
  expect(screen.getByTestId('stat-studies').textContent).toBe('10');
  expect(screen.getByTestId('stat-packages').textContent).toBe('5');
  expect(screen.getByTestId('stat-referrers').textContent).toBe('7');
  expect(screen.getByTestId('stat-orders-today').textContent).toBe('3');
  });

  it('fallback a length de array cuando /count falla', async () => {
    // Implementación: primeros 5 endpoints intentan /count y fallan, luego fallback list endpoints responden.
    apiClient.get.mockImplementation((path) => {
      if (path === '/patients/count') return Promise.reject(new Error('fail'));
      if (path === '/analysis/count') return Promise.reject(new Error('fail'));
      if (path === '/packages/count') return Promise.reject(new Error('fail'));
      if (path === '/referrers/count') return Promise.reject(new Error('fail'));
      if (path.startsWith('/work-orders/count')) return Promise.reject(new Error('fail'));

      // Fallback list endpoints now used
      if (path === '/patients') return Promise.resolve(new Array(2).fill({}));
      if (path === '/analysis') return Promise.resolve({ data: new Array(4).fill({}), page: { total: 4 } });
      if (path === '/packages') return Promise.resolve(new Array(3).fill({}));
      if (path === '/referrers') return Promise.resolve({ data: new Array(6).fill({}), page: { total: 6 } });
      if (path.startsWith('/work-orders/recent?window=30d')) return Promise.resolve([]);
      if (path.startsWith('/work-orders/recent?limit=5')) return Promise.resolve([]);
      if (path.startsWith('/work-orders')) return Promise.resolve(new Array(1).fill({}));
      return Promise.resolve([]);
    });

    renderWithProviders(<DashboardPage />);

    await screen.findByText(/Dashboard Principal/i);
    // Para evitar colisiones de números repetidos, localizamos por título del StatCard y luego validamos valor
    const getLatest = (testId) => {
      const all = screen.getAllByTestId(testId);
      return all[all.length - 1].textContent; // tomar la última instancia
    };
    expect(getLatest('stat-patients')).toBe('2');
    expect(getLatest('stat-studies')).toBe('4');
    expect(getLatest('stat-packages')).toBe('3');
    expect(getLatest('stat-referrers')).toBe('6');
    expect(getLatest('stat-orders-today')).toBe('1');
  });
});
