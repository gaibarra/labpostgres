import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';

vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => <>{children}</>,
  useTheme: () => ({ theme: 'light' })
}));

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

const renderDash = () => render(
  <BrowserRouter>
    <AuthProvider initialUser={{ id: 'u1', email: 'user@example.com', profile: { role: 'admin' } }}>
      <DashboardPage />
    </AuthProvider>
  </BrowserRouter>
);

function setupMocksWithOrders() {
  apiClient.get.mockImplementation((path) => {
    // Nuevo endpoint stats
    if (path === '/work-orders/stats') {
      return Promise.resolve({
        ordersToday: 0,
        ordersWeek: 0,
        ordersMonth: 0,
        revenueToday: 0,
        revenueWeek: 0,
        avgDeliveryTimeHours: null,
        conversionRate: 0,
        topStudies: [],
        statusBreakdown: {}
      });
    }
    // Nuevo endpoint status-summary
    if (path.startsWith('/work-orders/status-summary')) {
      return Promise.resolve({
        data: [],
        total: 0,
        period: '30 días'
      });
    }
    // Conteos
    if (path === '/patients/count') return Promise.resolve({ total: 0 });
    if (path === '/analysis/count') return Promise.resolve({ total: 0 });
    if (path === '/packages/count') return Promise.resolve({ total: 0 });
    if (path === '/referrers/count') return Promise.resolve({ total: 0 });
    if (path.startsWith('/work-orders/count')) return Promise.resolve({ total: 0 });
    if (path.startsWith('/work-orders/recent?window=30d')) return Promise.resolve([]);

    // Órdenes recientes con varios formatos de paciente
    if (path.startsWith('/work-orders/recent?limit=5')) {
      return Promise.resolve([
        { id: 'wo1', folio: 'F0001', status: 'Pendiente', patient: { full_name: 'Juan Pérez' } },
        { id: 'wo2', folio: 'F0002', status: 'Concluida', patient: { first_name: 'María', middle_name: 'Luisa', last_name: 'Gómez' } },
        { id: 'wo3', folio: 'F0003', status: 'Reportada', patient_name: 'Paciente Sin Perfil' },
        { id: 'wo4', folio: 'F0004', status: 'Procesando' } // Sin nombre -> dash
      ]);
    }

    // Fallbacks
    if (path === '/patients') return Promise.resolve([]);
    if (path === '/analysis') return Promise.resolve({ data: [], page: { total: 0 } });
    if (path === '/packages') return Promise.resolve([]);
    if (path === '/referrers') return Promise.resolve([]);
    if (path.startsWith('/work-orders')) return Promise.resolve([]);
    return Promise.resolve([]);
  });
}


describe('DashboardPage recent orders list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocksWithOrders();
  });
  afterEach(() => cleanup());

  it('muestra nombres de paciente normalizados y links navegables', async () => {
    renderDash();
    await screen.findByText(/Dashboard Principal/i);

    // Esperar a que carguen los datos con SWR
    await vi.waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Nombres normalizados
    expect(screen.getByText('María Luisa Gómez')).toBeInTheDocument();
    expect(screen.getByText('Paciente Sin Perfil')).toBeInTheDocument();

    // Caso sin nombre -> dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);

    // Links contienen highlight param y anchor
    const juanLink = screen.getByRole('link', { name: 'F0001' });
    expect(juanLink.getAttribute('href')).toMatch(/orders\?highlight=wo1#order-wo1/);
  });

});
