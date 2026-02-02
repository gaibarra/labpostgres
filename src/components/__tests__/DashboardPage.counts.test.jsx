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

// Mock responses para los nuevos endpoints
function setupDefaultMocks(overrides = {}) {
  apiClient.get.mockImplementation((path) => {
    // Nuevo endpoint stats
    if (path === '/work-orders/stats') {
      return Promise.resolve(overrides.stats || {
        ordersToday: 3,
        ordersWeek: 15,
        ordersMonth: 45,
        revenueToday: 5000,
        revenueWeek: 25000,
        avgDeliveryTimeHours: '4.5',
        conversionRate: 78.5,
        topStudies: [{ study_name: 'Biometría Hemática', count: 25 }],
        statusBreakdown: { Pendiente: 5, Procesando: 3, Reportada: 10 }
      });
    }
    // Nuevo endpoint status-summary
    if (path.startsWith('/work-orders/status-summary')) {
      return Promise.resolve(overrides.statusSummary || {
        data: [
          { name: 'Pendiente', value: 5, color: '#FBBF24' },
          { name: 'Reportada', value: 10, color: '#22C55E' }
        ],
        total: 15,
        period: '30 días'
      });
    }
    // Endpoints de conteo existentes
    if (path === '/patients/count') return Promise.resolve({ total: overrides.patients ?? 42 });
    if (path === '/analysis/count') return Promise.resolve({ total: overrides.studies ?? 10 });
    if (path === '/packages/count') return Promise.resolve({ total: overrides.packages ?? 5 });
    if (path === '/referrers/count') return Promise.resolve({ total: overrides.referrers ?? 7 });
    if (path.startsWith('/work-orders/count')) return Promise.resolve({ total: overrides.ordersToday ?? 3 });
    if (path.startsWith('/work-orders/recent?window=30d')) return Promise.resolve(overrides.recentWindow || []);
    if (path.startsWith('/work-orders/recent?limit=5')) return Promise.resolve(overrides.recentList || []);
    // Fallbacks
    if (path === '/patients') return Promise.resolve([]);
    if (path === '/analysis') return Promise.resolve({ data: [], page: { total: 0 } });
    if (path === '/packages') return Promise.resolve([]);
    if (path === '/referrers') return Promise.resolve([]);
    if (path.startsWith('/work-orders')) return Promise.resolve([]);
    return Promise.resolve([]);
  });
}

describe('DashboardPage counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('muestra los conteos correctos desde los endpoints /count', async () => {
    setupDefaultMocks({
      patients: 42,
      studies: 10,
      packages: 5,
      referrers: 7,
      ordersToday: 3
    });

    renderWithProviders(<DashboardPage />);

    // Esperar título principal para asegurar render
    await screen.findByText(/Dashboard Principal/i);

    // Verificar cada valor (con timeout para SWR)
    await vi.waitFor(() => {
      expect(screen.getByTestId('stat-patients').textContent).toBe('42');
    }, { timeout: 3000 });

    expect(screen.getByTestId('stat-studies').textContent).toBe('10');
    expect(screen.getByTestId('stat-packages').textContent).toBe('5');
    expect(screen.getByTestId('stat-referrers').textContent).toBe('7');
    expect(screen.getByTestId('stat-orders-today').textContent).toBe('3');
  });
});
