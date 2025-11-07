import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthProvider } from '@/contexts/AuthContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import OrderLabelsPrint from '@/components/modules/orders/OrderLabelsPrint.jsx';
import OrderLabelsPreviewModal from '@/components/modules/orders/OrderLabelsPreviewModal.jsx';
import { setToken, clearToken } from '@/lib/apiClient.js';

// Small helper -> Response shim for Node fetch
const jsonResponse = (obj, init = {}) => new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });

// Test data builders
const buildAuthUser = () => ({ user: { id: 'u1', full_name: 'Test User', role: 'admin' } });
const buildOrder = () => ({ id: '123', folio: 'F000123', order_date: new Date().toISOString(), patient_id: 'p1', selected_items: [{ item_id: 's1', item_type: 'study' }] });
const buildPatient = () => ({ id: 'p1', full_name: 'John Doe' });
const buildStudies = () => ({ data: [{ id: 's1', name: 'Hemograma', sample_container: 'Tubo lila' }] });
const buildPackages = () => ({ data: [] });

function installFetchMockTrackAuth(expectedToken) {
  const original = global.fetch;
  const seen = { meAuth: null, workOrderAuth: null, patientsAuth: null, studiesAuth: null, packagesAuth: null };
  const getAuth = (init) => {
    try {
      const h = new Headers(init?.headers || {});
      return h.get('Authorization');
    } catch { return null; }
  };
  const fetchMock = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const auth = getAuth(init);
    if (/\/api\/auth\/me(?:$|[?#])/.test(url)) {
      seen.meAuth = auth;
      return Promise.resolve(jsonResponse(buildAuthUser()));
    }
    if (/\/api\/work-orders\/123(?:$|[?#])/.test(url)) {
      seen.workOrderAuth = auth;
      return Promise.resolve(jsonResponse(buildOrder()));
    }
    if (/\/api\/patients\/p1(?:$|[?#])/.test(url)) {
      seen.patientsAuth = auth;
      return Promise.resolve(jsonResponse(buildPatient()));
    }
    if (/\/api\/analysis(?:$|[?#])/.test(url)) {
      seen.studiesAuth = auth;
      return Promise.resolve(jsonResponse(buildStudies()));
    }
    if (/\/api\/packages\/detailed(?:$|[?#])/.test(url)) {
      seen.packagesAuth = auth;
      return Promise.resolve(jsonResponse(buildPackages()));
    }
    // Default passthrough
    return original(input, init);
  };
  vi.spyOn(global, 'fetch').mockImplementation(fetchMock);
  return { restore: () => global.fetch.mockRestore(), seen, expected: `Bearer ${expectedToken}` };
}

function renderWithProviders(ui, { initialEntries = ['/'] } = {}) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </AuthProvider>
  );
}

describe('OrderLabelsPrint auth bootstrap', () => {
  beforeEach(() => { clearToken(); });
  afterEach(() => { try { global.fetch.mockRestore?.(); } catch (_) { /* ignore */ } });

  it('uses hash #at=TOKEN to set auth and loads data with Authorization header', async () => {
    const token = 'hash-token-123';
    const { seen, expected } = installFetchMockTrackAuth(token);

    renderWithProviders(
      <Routes>
        <Route path="/print/order-labels/:orderId" element={<ProtectedRoute><OrderLabelsPrint /></ProtectedRoute>} />
      </Routes>,
      { initialEntries: [`/print/order-labels/123#at=${encodeURIComponent(token)}`] }
    );

    // Wait for patient name from print content
    await waitFor(() => expect(screen.getByText(/John Doe/)).toBeInTheDocument());

    // Assert Authorization headers carried the token
    expect(seen.meAuth).toBe(expected);
    expect(seen.workOrderAuth).toBe(expected);
    expect(seen.patientsAuth).toBe(expected);
    expect(seen.studiesAuth).toBe(expected);
    expect(seen.packagesAuth).toBe(expected);
  });

  it('accepts token via postMessage when no hash is present', async () => {
    const token = 'pm-token-456';
    const { seen, expected } = installFetchMockTrackAuth(token);

    renderWithProviders(
      <Routes>
        <Route path="/print/order-labels/:orderId" element={<ProtectedRoute><OrderLabelsPrint /></ProtectedRoute>} />
      </Routes>,
      { initialEntries: [`/print/order-labels/123`] }
    );

    // Simulate message from opener with the token
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'LABG40_AUTH_TOKEN', token },
    }));

    await waitFor(() => expect(screen.getByText(/John Doe/)).toBeInTheDocument());
    expect(seen.meAuth).toBe(expected);
    expect(seen.workOrderAuth).toBe(expected);
  });
});

describe('OrderLabelsPreviewModal behavior', () => {
  beforeEach(() => { clearToken(); });
  it('opens print URL with #at and posts token to new window', async () => {
    const token = 'preview-token-789';
    setToken(token);
    const postMessage = vi.fn();
    const mockWin = { postMessage };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(mockWin);

    renderWithProviders(
      <OrderLabelsPreviewModal isOpen={true} onOpenChange={() => {}} order={{ id: '123', folio: 'F000123' }} />,
      { initialEntries: ['/orders'] }
    );

    const btn = await screen.findByRole('button', { name: /Continuar a Impresión/i });
    await userEvent.click(btn);

    expect(openSpy).toHaveBeenCalled();
    const url = openSpy.mock.calls[0][0];
    expect(url).toMatch(/\/print\/order-labels\/123#at=/);

    // postMessage retries are scheduled; flush timers
    vi.useFakeTimers();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();

    expect(postMessage).toHaveBeenCalledWith({ type: 'LABG40_AUTH_TOKEN', token }, window.location.origin);

    openSpy.mockRestore();
  });
});
