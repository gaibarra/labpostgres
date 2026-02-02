import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
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

function setupMocks() {
    apiClient.get.mockImplementation((path) => {
        if (path === '/work-orders/stats') {
            return Promise.resolve({
                ordersToday: 5, ordersWeek: 20, ordersMonth: 100,
                revenueToday: 5000, revenueWeek: 25000,
                avgDeliveryTimeHours: '4.5', conversionRate: 78.5,
                topStudies: [], statusBreakdown: {}
            });
        }
        if (path.startsWith('/work-orders/status-summary')) {
            return Promise.resolve({ data: [], total: 0, period: '30 días' });
        }
        if (path === '/patients/count') return Promise.resolve({ total: 42 });
        if (path === '/analysis/count') return Promise.resolve({ total: 10 });
        if (path === '/packages/count') return Promise.resolve({ total: 5 });
        if (path === '/referrers/count') return Promise.resolve({ total: 7 });
        if (path.startsWith('/work-orders/count')) return Promise.resolve({ total: 5 });
        if (path.startsWith('/work-orders/recent')) return Promise.resolve([]);
        return Promise.resolve([]);
    });
}

describe('DashboardPage navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupMocks();
    });
    afterEach(() => cleanup());

    it('tiene StatCards con links a las secciones correctas', async () => {
        render(
            <BrowserRouter>
                <AuthProvider initialUser={{
                    id: 'u1',
                    email: 'user@test.com',
                    profile: { role: 'admin', first_name: 'Test', last_name: 'User' }
                }}>
                    <DashboardPage />
                </AuthProvider>
            </BrowserRouter>
        );

        await screen.findByText(/Dashboard Principal/i);

        // Verificar que las StatCards tienen los links correctos
        const patientLink = screen.getByRole('link', { name: /Pacientes Registrados/i });
        expect(patientLink.getAttribute('href')).toBe('/patients');

        const ordersLink = screen.getByRole('link', { name: /Órdenes de Hoy/i });
        expect(ordersLink.getAttribute('href')).toBe('/orders');

        const studiesLink = screen.getByRole('link', { name: /Estudios Disponibles/i });
        expect(studiesLink.getAttribute('href')).toBe('/studies');

        const packagesLink = screen.getByRole('link', { name: /Paquetes Disponibles/i });
        expect(packagesLink.getAttribute('href')).toBe('/packages');

        const referrersLink = screen.getByRole('link', { name: /Médicos Referentes/i });
        expect(referrersLink.getAttribute('href')).toBe('/referrers');
    });

    it('tiene acciones rápidas funcionales', async () => {
        render(
            <BrowserRouter>
                <AuthProvider initialUser={{
                    id: 'u1',
                    email: 'user@test.com',
                    profile: { role: 'admin', first_name: 'Admin', last_name: 'User' }
                }}>
                    <DashboardPage />
                </AuthProvider>
            </BrowserRouter>
        );

        await screen.findByText(/Dashboard Principal/i);

        // Verificar acciones rápidas
        const newOrderBtn = screen.getByRole('link', { name: /Nueva Orden/i });
        expect(newOrderBtn.getAttribute('href')).toBe('/orders?action=new');

        const newPatientBtn = screen.getByRole('link', { name: /Nuevo Paciente/i });
        expect(newPatientBtn.getAttribute('href')).toBe('/patients?action=new');

        const searchBtn = screen.getByRole('link', { name: /Buscar Orden/i });
        expect(searchBtn.getAttribute('href')).toBe('/orders');

        const reportsBtn = screen.getByRole('link', { name: /Reportes/i });
        expect(reportsBtn.getAttribute('href')).toBe('/finance/income-report');
    });

    it('muestra el nombre del usuario y su rol', async () => {
        render(
            <BrowserRouter>
                <AuthProvider initialUser={{
                    id: 'u1',
                    email: 'user@test.com',
                    profile: { role: 'laboratorista', first_name: 'Maria', last_name: 'Lopez' }
                }}>
                    <DashboardPage />
                </AuthProvider>
            </BrowserRouter>
        );

        await screen.findByText(/Dashboard Principal/i);

        // Verificar que muestra el nombre del usuario
        expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
        expect(screen.getByText(/laboratorista/i)).toBeInTheDocument();
    });

    it('tiene botón de actualizar funcional', async () => {
        render(
            <BrowserRouter>
                <AuthProvider initialUser={{
                    id: 'u1',
                    email: 'user@test.com',
                    profile: { role: 'admin' }
                }}>
                    <DashboardPage />
                </AuthProvider>
            </BrowserRouter>
        );

        await screen.findByText(/Dashboard Principal/i);

        // Verificar que existe el botón de actualizar
        const refreshBtn = screen.getByRole('button', { name: /Actualizar/i });
        expect(refreshBtn).toBeInTheDocument();
    });
});
