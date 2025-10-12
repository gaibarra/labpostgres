import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }));

// Mock Dialog components used inside PatientForm (DialogFooter/DialogClose) to eliminate Radix context dependency
vi.mock('@/components/ui/dialog', () => ({
  DialogFooter: ({ children }) => <div data-testid="dialog-footer">{children}</div>,
  DialogClose: ({ children }) => <>{children}</>
}));

import PatientForm from '@/components/modules/patients/PatientForm.jsx';

// Helper render
function setup(patient, onSave = vi.fn()) {
  render(<PatientForm patient={patient} onSave={onSave} onCancel={() => {}} isLoading={false} />);
  return { onSave };
}

describe('PatientForm sex mapping', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('mapea código M a etiqueta Masculino en el select', () => {
    setup({ id: 'p1', full_name: 'Juan Perez', sex: 'M', date_of_birth: '1990-05-10', email: 'p1@example.com' });
    const select = screen.getByLabelText(/Sexo/i);
    expect(select.value).toBe('Masculino');
  });

  it('mapea código F a etiqueta Femenino', () => {
    setup({ id: 'p2', full_name: 'Ana Lopez', sex: 'F', date_of_birth: '1985-01-20', email: 'p2@example.com' });
    const select = screen.getByLabelText(/Sexo/i);
    expect(select.value).toBe('Femenino');
  });

  // Eliminado caso 'O' porque ya no se soporta 'Otro'

  it('normaliza etiqueta seleccionada a código backend al guardar', () => {
    const { onSave } = setup({ id: 'p4', full_name: 'Luis Gomez', sex: 'M', date_of_birth: '1992-03-15', email: 'luis@example.com' }, vi.fn());
    const select = screen.getByLabelText(/Sexo/i);
    // Cambiar a Femenino
    fireEvent.change(select, { target: { value: 'Femenino', name: 'sex' } });
    // Llenar campos requeridos faltantes
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'luis@example.com', name: 'email' } });
    const saveButtons = screen.getAllByRole('button', { name: /^Guardar$/i });
    fireEvent.click(saveButtons[0]);
    expect(onSave).toHaveBeenCalled();
    const payload = onSave.mock.calls[0][0];
    expect(payload.sex).toBe('F');
  });
});
