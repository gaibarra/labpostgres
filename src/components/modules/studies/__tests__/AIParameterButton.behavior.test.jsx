import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/*
  Objetivo de esta batería:
  Seguir de forma granular el ciclo de vida del botón "Parámetro IA" dentro de StudyForm:
    1. Estado inicial (texto, atributos, habilitado)
    2. Transición al estado de carga (cambia texto a "Generando...", aria-busy, disabled)
    3. Abertura del diálogo avanzado (título presente)
    4. Restablecimiento automático del botón tras timeout de 1200 ms (regresa a texto original y se habilita)
    5. Evitar clicks duplicados mientras está en modo loading
    6. Escenario de error: si onAIAddParameter lanza excepción, el estado se restablece.

  NOTA: El flujo de generación del parámetro IA (sugerir nombre, aceptar y sincronizar) ya se valida en
  AIAssistParameterDialog.integration.test.jsx. Aquí nos enfocamos en la UX del botón y su máquina de estados.
*/

// Wrapper reutilizando StudiesModalsHost (integra StudyForm y los diálogos)
import { StudiesModalsHost } from '../../studies/StudiesModalsHost.jsx';

function IntegrationWrapper({ study, overrideOnAIAddParameter }) {
  const handleImmediateParameterSave = vi.fn();
  const props = {
    isFormOpen: true,
    setIsFormOpen: () => {},
    currentStudy: study,
    handleFormSubmit: vi.fn(),
    isSubmitting: false,
    loadingStudies: false,
    searchTerm: '',
    setSearchTerm: () => {},
    onNewStudyClick: () => {},
    onEditStudy: () => {},
    onDeleteRequest: () => {},
    onAssignPrices: () => {},
    onAIAssist: () => {},
    onHelp: () => {},
    StudiesHeaderComponent: () => <div />,
    StudiesTableComponent: () => <div />,
    StudiesCardViewComponent: () => <div />,
    isMobile: false,
    studyToDelete: null,
    setStudyToDelete: () => {},
    isDeleteConfirmOpen: false,
    setIsDeleteConfirmOpen: () => {},
    handleConfirmDelete: () => {},
    isAIAssistOpen: false,
    setIsAIAssistOpen: () => {},
    aiGeneratedData: null,
    setAiGeneratedData: () => {},
    isPreviewModalOpen: false,
    setIsPreviewModalOpen: () => {},
    handleAcceptAIPreview: () => {},
    handleCancelAIPreview: () => {},
    studyForPricing: null,
    setStudyForPricing: () => {},
    isPriceModalOpen: false,
    setIsPriceModalOpen: () => {},
    updateStudyPrices: () => {},
    referrers: [],
    persistParameterOrder: vi.fn(),
    handleImmediateParameterSave,
    handleImmediateParameterDelete: vi.fn(),
    getParticularPriceForStudy: vi.fn(),
    invalidHighlight: null,
    enableInstrumentation: false
  };

  // Monkey patch: permitimos inyectar un override para provocar error en test específico.
  if (overrideOnAIAddParameter) {
    // Injectamos un prop improvisado en el objeto que StudyForm no usa directamente (StudiesModalsHost encapsula onAIAddParameter),
    // así que no podemos sobrescribir sin modificar el host. Para el escenario de error
    // haremos un test unitario directo sobre StudyForm donde sí podemos proporcionar la prop.
  }

  return <StudiesModalsHost {...props} />;
}

// Test unitario directo de StudyForm para simular excepción en onAIAddParameter
import StudyForm from '../../studies/StudyForm.jsx';

function DirectStudyFormWrapper({ onAIAddParameter }) {
  const study = { id: 'study-x', name: 'Panel Inflamación', category: 'Hematología', parameters: [] };
  return (
    <StudyForm
      initialStudy={study}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      isSubmitting={false}
      onAIAssist={vi.fn()}
      onImmediateParameterSave={vi.fn()}
      onImmediateParameterDelete={vi.fn()}
      onPersistParameterOrder={vi.fn()}
      onAIAddParameter={onAIAddParameter}
      invalidHighlight={null}
    />
  );
}

describe('Botón "Parámetro IA" - comportamiento detallado', () => {

  test('transición de estados: idle -> loading -> idle y apertura de diálogo', async () => {
    const study = { id: 'study-001', name: 'Perfil Básico', category: 'Química Clínica', parameters: [] };
    render(<IntegrationWrapper study={study} />);

    const button = await screen.findByRole('button', { name: /Parámetro IA/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent(/Parámetro IA/i);
    expect(button).toHaveAttribute('aria-busy', 'false');

    // Click inicia loading temporal (1200ms)
    fireEvent.click(button);
    // Estado loading inmediato
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent(/Generando.../i);
    expect(button).toHaveAttribute('aria-busy', 'true');

    // Segundo click durante loading NO debe modificar llamadas adicionales (disabled evita interacción)
    fireEvent.click(button); // no debería cambiar nada

  // Esperar a que se restaure (loading interno usa setTimeout ~1200ms). Añadimos margen.
  await new Promise(r => setTimeout(r, 1400));

    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent(/Parámetro IA/i);
      expect(button).toHaveAttribute('aria-busy', 'false');
    });

    // Verificamos que el diálogo avanzado se montó (título). Puede tardar un tick en aparecer.
  // El diálogo avanzado debe contener botón para generar rangos
  const dialogTrigger = await screen.findByTestId('ai-generate-ranges-btn');
    expect(dialogTrigger).toBeInTheDocument();
  });

  test('el estado loading se revierte aunque onAIAddParameter lance error', async () => {
    const faulty = vi.fn(() => { throw new Error('Falla simulada'); });
    render(<DirectStudyFormWrapper onAIAddParameter={faulty} />);
    const button = await screen.findByRole('button', { name: /Parámetro IA/i });

    fireEvent.click(button);
    // Debido a que la excepción es síncrona, el catch restaura inmediatamente aiParamLoading=false.
    // Verificamos que NO queda en estado 'Generando...' ni disabled sostenido.
    await new Promise(r => setTimeout(r, 20));
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(button).toHaveTextContent(/Parámetro IA/i);
    expect(faulty).toHaveBeenCalledTimes(1);
  });
});
