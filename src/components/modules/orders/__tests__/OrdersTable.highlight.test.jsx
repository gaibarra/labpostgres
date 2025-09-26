import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import OrdersTable from '@/components/modules/orders/OrdersTable.jsx';

const sampleOrders = [
  { id: 'o1', folio: 'F001', order_date: new Date().toISOString(), patient_name: 'Paciente 1', status: 'Pendiente', total_price: 100 },
  { id: 'o2', folio: 'F002', order_date: new Date().toISOString(), patient_name: 'Paciente 2', status: 'Concluida', total_price: 200 },
];

describe('OrdersTable highlight', () => {
  beforeEach(() => { /* no-op */ });
  afterEach(() => cleanup());

  it('marca la fila cuyo id coincide con highlightId', () => {
    render(<OrdersTable orders={sampleOrders} isLoading={false} highlightId="o2" onEdit={()=>{}} onDelete={()=>{}} onOpenModal={()=>{}} />);
    const highlighted = document.querySelector('[data-highlighted="true"]');
    expect(highlighted).not.toBeNull();
    expect(highlighted?.id).toBe('order-o2');
    expect(highlighted?.className).toMatch(/ring-sky-400|ring-sky-500/);
  });

  it('no marca ninguna fila si highlightId no coincide', () => {
    render(<OrdersTable orders={sampleOrders} isLoading={false} highlightId="zzz" onEdit={()=>{}} onDelete={()=>{}} onOpenModal={()=>{}} />);
    const highlighted = document.querySelector('[data-highlighted="true"]');
    expect(highlighted).toBeNull();
  });
});
