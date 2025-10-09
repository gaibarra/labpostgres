import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import OrderResultsModal from '../OrderResultsModal.jsx';
import { AuthProvider } from '@/contexts/AuthContext.jsx';

const baseOrder = { id: 'ord-1', folio: '20251008-001', status: 'Pendiente', order_date: new Date().toISOString(), selected_items: [], results: {} };
const patient = { id: 'pat-1', full_name: 'Paciente Demo', date_of_birth: '2000-01-01' };

function setup(status='Pendiente') {
  const onSaveResults = vi.fn((...args)=>args);
  const onValidateAndPreview = vi.fn();
  render(
    <AuthProvider initialUser={null}>
      <OrderResultsModal
        isOpen={true}
        onOpenChange={()=>{}}
        order={{ ...baseOrder, status }}
        studiesDetails={[]}
        packagesData={[]}
        patient={patient}
        onSaveResults={onSaveResults}
        onValidateAndPreview={onValidateAndPreview}
        workflowStage={'draft'}
      />
    </AuthProvider>
  );
  return { onSaveResults, onValidateAndPreview };
}

describe('Result workflow buttons', () => {
  it('renders draft save and validate buttons', () => {
    setup();
    expect(screen.getByText(/Guardar Borrador/i)).toBeInTheDocument();
    expect(screen.getByText(/Validar y Previsualizar/i)).toBeInTheDocument();
  });
  it('calls onSaveResults when clicking Guardar Borrador', () => {
  const { onSaveResults } = setup();
  const dialogs = screen.getAllByRole('dialog');
  const currentDialog = dialogs[dialogs.length - 1];
  const utils = within(currentDialog);
  const button = utils.getByRole('button', { name: /Guardar Borrador/i });
  fireEvent.click(button);
    expect(onSaveResults).toHaveBeenCalled();
  });
  it('calls onValidateAndPreview when clicking Validar y Previsualizar', () => {
  const { onValidateAndPreview } = setup();
  const dialogs = screen.getAllByRole('dialog');
  const currentDialog = dialogs[dialogs.length - 1];
  const utils = within(currentDialog);
  const button = utils.getByRole('button', { name: /Validar y Previsualizar/i });
  fireEvent.click(button);
    expect(onValidateAndPreview).toHaveBeenCalled();
  });
});
