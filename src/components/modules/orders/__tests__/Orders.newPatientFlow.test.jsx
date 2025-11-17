import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Orders from '@/components/modules/Orders.jsx';

vi.mock('use-debounce', () => ({
  useDebounce: (value) => [value],
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('@/components/modules/orders/OrdersHeader', () => ({
  default: () => <div data-testid="orders-header">Orders Header</div>,
}));

vi.mock('@/components/modules/orders/OrdersTable', () => ({
  default: () => <div data-testid="orders-table">Orders Table</div>,
}));

vi.mock('@/components/modules/orders/OrderHelpDialog', () => ({
  default: () => null,
}));

const mockUseOrderManagement = vi.fn();
const mockUseOrderModals = vi.fn();

vi.mock('@/components/modules/orders/hooks/useOrderManagement', () => ({
  useOrderManagement: (...args) => mockUseOrderManagement(...args),
}));

vi.mock('@/components/modules/orders/hooks/useOrderModals.jsx', () => ({
  useOrderModals: (...args) => mockUseOrderModals(...args),
}));

const buildOrderManagementState = (overrides = {}) => ({
  orders: [],
  ordersMeta: { search: '', page: 1, totalPages: 1, pageSize: 10, total: 0 },
  patients: [{ id: 'p1', full_name: 'Paciente Demo' }],
  referrers: [],
  studies: [],
  packages: [],
  initialOrderForm: { patient_id: null, priority: 'normal' },
  isLoading: false,
  handleSubmitOrder: vi.fn(),
  handleDeleteOrder: vi.fn(),
  handleSaveResults: vi.fn(),
  getStudiesAndParametersForOrder: vi.fn(),
  loadData: vi.fn(),
  loadOrders: vi.fn(),
  ...overrides,
});

const LocationRecorder = ({ onChange }) => {
  const location = useLocation();
  useEffect(() => {
    onChange(location.state);
  }, [location, onChange]);
  return null;
};

const NavButtons = () => {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate('/dashboard')}>Ir a dashboard</button>
      <button onClick={() => navigate('/orders')}>Volver a órdenes</button>
    </div>
  );
};

describe('Orders new patient navigation flow', () => {
  let openModalSpy;
  let orderManagementState;

  beforeEach(() => {
    openModalSpy = vi.fn();
    orderManagementState = buildOrderManagementState();
    mockUseOrderManagement.mockReturnValue(orderManagementState);
    mockUseOrderModals.mockReturnValue({
      modalState: { isOpen: false },
      openModal: openModalSpy,
      modalComponent: null,
    });
  });

  it('opens the order modal once for a new patient and clears the router state', async () => {
    const recordedStates = [];

    render(
      <MemoryRouter initialEntries={[{ pathname: '/orders', state: { newPatientId: 'p1' } }]}> 
        <Routes>
          <Route
            path="/orders"
            element={(
              <>
                <Orders />
                <LocationRecorder onChange={(value) => recordedStates.push(value)} />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(openModalSpy).toHaveBeenCalledTimes(1));
    expect(openModalSpy).toHaveBeenCalledWith('form', { ...orderManagementState.initialOrderForm, patient_id: 'p1' });

    await waitFor(() => {
      expect(recordedStates.length).toBeGreaterThan(1);
      expect(recordedStates.at(-1)).toEqual({});
    });
    expect(recordedStates[0]).toEqual({ newPatientId: 'p1' });
  });

  it('does not reopen the modal when navigating away and back without a new patient id', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/orders', state: { newPatientId: 'p1' } }]}> 
        <>
          <Routes>
            <Route path="/orders" element={<Orders />} />
            <Route path="/dashboard" element={<div>Dashboard page</div>} />
          </Routes>
          <NavButtons />
        </>
      </MemoryRouter>
    );

    await waitFor(() => expect(openModalSpy).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /ir a dashboard/i }));
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /volver a órdenes/i }));
    await waitFor(() => expect(screen.getAllByTestId('orders-header')).not.toHaveLength(0));

    expect(openModalSpy).toHaveBeenCalledTimes(1);
  });
});
