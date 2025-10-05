import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import { StudiesModalsHost } from '../../studies/StudiesModalsHost.jsx';

// Mock subcomponent AIAssistParameterDialog to drive acceptance quickly? Prefer usar real; sólo mockeamos fetch.

function Wrapper({ study }) {
  // Mock que además de registrar la llamada emite la petición fetch real a parameters-sync
  const handleImmediateParameterSave = vi.fn(async (studyId, param) => {
    try {
      await fetch(`/api/analysis/${studyId}/parameters-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: [param] })
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[test][handleImmediateParameterSave] fallo fetch parameters-sync', e);
    }
    return true;
  });
  // Exponer para aserciones externas
  window.__mock_handleImmediateParameterSave = handleImmediateParameterSave;
  const props = {
    isFormOpen: true,
    setIsFormOpen: ()=>{},
    currentStudy: study,
    handleFormSubmit: vi.fn(),
    isSubmitting: false,
    loadingStudies: false,
    searchTerm: '',
    setSearchTerm: ()=>{},
    onNewStudyClick: ()=>{},
    onEditStudy: ()=>{},
    onDeleteRequest: ()=>{},
    onAssignPrices: ()=>{},
    onAIAssist: ()=>{},
    onHelp: ()=>{},
    StudiesHeaderComponent: ()=> <div />,
    StudiesTableComponent: ()=> <div />,
    StudiesCardViewComponent: ()=> <div />,
    isMobile: false,
    studyToDelete: null,
    setStudyToDelete: ()=>{},
    isDeleteConfirmOpen: false,
    setIsDeleteConfirmOpen: ()=>{},
    handleConfirmDelete: ()=>{},
    isAIAssistOpen: false,
    setIsAIAssistOpen: ()=>{},
    aiGeneratedData: null,
    setAiGeneratedData: ()=>{},
    isPreviewModalOpen: false,
    setIsPreviewModalOpen: ()=>{},
    handleAcceptAIPreview: ()=>{},
    handleCancelAIPreview: ()=>{},
    studyForPricing: null,
    setStudyForPricing: ()=>{},
    isPriceModalOpen: false,
    setIsPriceModalOpen: ()=>{},
    updateStudyPrices: ()=>{},
    referrers: [],
    persistParameterOrder: vi.fn(),
    handleImmediateParameterSave,
    handleImmediateParameterDelete: vi.fn(),
    getParticularPriceForStudy: vi.fn(),
    invalidHighlight: null,
    enableInstrumentation: false
  };
  return <StudiesModalsHost {...props} />;
}

describe('Integración aceptación parámetro IA', () => {
  test('llama handleImmediateParameterSave(studyId, param) y hace sync', async () => {
    // Mock fetch para generación IA
    const genResponse = {
      parameter: {
        name: 'Proteína Reactiva Ultra',
        unit: 'mg/L',
        reference_ranges: [
          { sex: 'ambos', age_min: null, age_max: null, age_min_unit: 'años', lower: 0, upper: 5, text_value: '' }
        ]
      }
    };
    const origFetch = global.fetch;
    const fetchMock = vi.fn(async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/analysis/ai/generate-parameter')) {
        return new Response(JSON.stringify(genResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (/\/api\/analysis\/.+\/parameters-sync/.test(url)) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return origFetch(input, init);
    });
    global.fetch = fetchMock;

    const study = { id: 'study-123', name: 'Perfil Inflamatorio', parameters: [] };
    render(<Wrapper study={study} />);

    // Abrir diálogo parámetro IA: simulamos evento usado en StudyForm -> onAIAddParameter
    // Simplificación: disparar CustomEvent que StudyForm podría usar; si no existe, manipulamos estado directamente simulando botón.
    // Buscamos botón "Parámetro IA" en caso ya exista en UI (si StudyForm lo renderiza). Si no, forzamos apertura vía dispatch.
    // Fallback: crear un botón dinámico para abrir estado interno: accedemos al body y disparamos evento.

    // Estrategia: forzar dispatch manual creando evento global reconocido por StudiesModalsHost? No expone API.
    // Optamos por simular la secuencia mínima: set del estado a isAIParamDialogOpen. Para evitar acceso interno, ejecutamos un click sobre trigger si presente.
    const openButton = screen.queryByText(/Parámetro IA/i) || screen.queryByRole('button', { name: /parámetro ia/i });
    if (openButton) {
      fireEvent.click(openButton);
    } else {
      // Si no hay botón, fall back: inyectamos y disparamos evento que Radix/host no usa; no podemos sin exponer hook. Abort test si no se encuentra.
      // Mejor: abort early mostrando advertencia (el test pasará señalando falta de trigger si cambia el markup en el futuro).
      console.warn('[test][AIAssistParameterDialog.integration] Botón Parámetro IA no encontrado; test podría requerir actualización si UI cambia.');
    }

    // Nueva UX: sugerir nombre -> aceptar
    const suggestBtn = await waitFor(()=> screen.getByRole('button', { name: /sugerir nombre/i }), { timeout: 1000 });
    fireEvent.click(suggestBtn);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/analysis/ai/generate-parameter'), expect.any(Object));
    });
    await waitFor(()=> expect(screen.getByDisplayValue(/proteína reactiva ultra/i)).toBeInTheDocument());
    const acceptBtn = screen.getByRole('button', { name: /aceptar/i });
    fireEvent.click(acceptBtn);

    // Verificamos que fetch haya hecho sync (parameters-sync)
    await waitFor(() => {
      const hasSyncCall = fetchMock.mock.calls.some(c => (typeof c[0] === 'string') && /parameters-sync/.test(c[0]));
      expect(hasSyncCall).toBe(true);
    });

    // Extra: validar cuerpo enviado a parameters-sync (estructura mínima)
    const syncCall = fetchMock.mock.calls.find(c => (typeof c[0] === 'string') && /parameters-sync/.test(c[0]));
    expect(syncCall).toBeDefined();
    const syncInit = syncCall[1];
    expect(syncInit).toBeDefined();
    expect(syncInit.method).toBe('POST');
    expect(typeof syncInit.body).toBe('string');
    let parsed;
    try { parsed = JSON.parse(syncInit.body); } catch { parsed = null; }
    expect(parsed).toBeTruthy();
    expect(Array.isArray(parsed.parameters)).toBe(true);
    expect(parsed.parameters.length).toBe(1);
    const sentParam = parsed.parameters[0];
    expect(sentParam).toMatchObject({ name: 'Proteína Reactiva Ultra' });
  // position debe existir (>=1) (añadido por handleImmediateParameterSave enriquecido)
  expect(typeof sentParam.position === 'number' && sentParam.position >= 1).toBe(true);

    // Verificamos firma: primer arg es studyId string, segundo objeto con name y reference_ranges
    try {
      const mockFn = window.__mock_handleImmediateParameterSave;
      expect(mockFn).toBeDefined();
      expect(mockFn).toHaveBeenCalled();
      const call = mockFn.mock.calls[0];
      expect(call[0]).toBe('study-123');
      expect(call[1]).toMatchObject({ name: 'Proteína Reactiva Ultra' });
    } finally {
      // Limpieza y restaurar fetch original para no contaminar otros tests
      delete window.__mock_handleImmediateParameterSave;
      global.fetch = origFetch;
    }
  });
});
