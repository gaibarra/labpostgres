import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import AIAssistParameterDialog from '../AIAssistParameterDialog.jsx';

// Mock handleImmediateParameterSave y render directo del dialog

describe('Integración aceptación parámetro IA', () => {
  test('llama handleImmediateParameterSave(studyId, param) y hace sync', async () => {
    // Mock fetch para generación IA
    const genResponse = {
      parameter: {
        name: 'Proteína Reactiva Ultra',
        unit: 'mg/L',
        reference_ranges: [
          { sex: 'Ambos', age_min: 0, age_max: 120, age_min_unit: 'años', lower: 0, upper: 5, text_value: '' }
        ]
      }
    };
    const origFetch = global.fetch;
    const fetchMock = vi.fn(async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/ai/generate-parameter/async')) {
        return new Response(JSON.stringify({ jobId: 'job-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/ai/generate-parameter/job/job-1')) {
        return new Response(JSON.stringify({ id:'job-1', status:'done', progress:100, message:'ok', parameter: genResponse.parameter }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (/\/api\/analysis\/.+\/parameters-sync/.test(url)) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return origFetch(input, init);
    });
    global.fetch = fetchMock;

    const study = { id: 'study-123', name: 'Perfil Inflamatorio', parameters: [] };
    const handleAccept = vi.fn(async (param) => {
      // Simula lógica de guardado inmediato (parameters-sync)
      await fetch(`/api/analysis/${study.id}/parameters-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: [ { ...param, position: 1 } ] })
      });
    });
    // Guardamos ref global para verificación posterior
    window.__mock_handleImmediateParameterSave = handleAccept;
    render(<AIAssistParameterDialog isOpen studyId={study.id} studyName={study.name} existingParameters={[]} onAccept={(p)=> handleAccept(p)} onOpenChange={()=>{}} />);

  // Nueva UX: generar rangos -> aceptar
  // Primero ingresar nombre válido (requisito para habilitar generación)
  const nameInputList = screen.getAllByPlaceholderText(/índice inflamatorio tiroideo/i);
  const nameInput = nameInputList[nameInputList.length -1];
  fireEvent.change(nameInput, { target: { value: 'Proteina Reactiva Ultra' } });
    const suggestBtn = await waitFor(()=> {
      const all = screen.getAllByTestId('ai-generate-ranges-btn');
      return all[all.length - 1];
    }, { timeout: 1000 });
    fireEvent.click(suggestBtn);
    await waitFor(() => {
      // Ahora el diálogo usa endpoint /api/ai/generate-parameter/async
      const calledAsync = fetchMock.mock.calls.some(c => (typeof c[0] === 'string') && c[0].includes('/api/ai/generate-parameter/async'));
      expect(calledAsync).toBe(true);
    });
    // El input de nombre puede tener label "Nombre" o similar; buscamos por role textbox y coincidencia parcial del valor
    // Nueva UX: el nombre de entrada del usuario se conserva; no se auto-reemplaza por la sugerencia AI.
    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      const match = inputs.some(i => /proteina reactiva ultra/i.test(i.value));
      expect(match).toBe(true);
    }, { timeout: 3000 });
  const acceptBtn = screen.getByRole('button', { name: /aceptar/i });
    // Esperar a que deje de estar deshabilitado (loading=false y nombre válido)
    await waitFor(() => expect(acceptBtn).not.toBeDisabled(), { timeout: 3000 });
    fireEvent.click(acceptBtn);

    // Verificamos que fetch haya hecho sync (parameters-sync)
    await waitFor(() => {
      const hasSyncCall = fetchMock.mock.calls.some(c => (typeof c[0] === 'string') && /parameters-sync/.test(c[0]));
      expect(hasSyncCall).toBe(true);
    });

    // Extra: validar cuerpo enviado a parameters-sync (estructura mínima + valorReferencia)
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
  // Se envía exactamente el nombre ingresado por el usuario (sin acento si el usuario no lo escribió)
  expect(sentParam).toMatchObject({ name: 'Proteina Reactiva Ultra' });
  // position debe existir (>=1) (añadido por handleImmediateParameterSave enriquecido)
  expect(typeof sentParam.position === 'number' && sentParam.position >= 1).toBe(true);
    expect(Array.isArray(sentParam.valorReferencia)).toBe(true);
    expect(sentParam.valorReferencia.length).toBeGreaterThan(0);

  // Verificamos que onAccept fuera llamado con el nombre del usuario
  expect(window.__mock_handleImmediateParameterSave).toHaveBeenCalled();
  const acceptedPayload = window.__mock_handleImmediateParameterSave.mock.calls[0][0];
  expect(acceptedPayload).toMatchObject({ name: 'Proteina Reactiva Ultra', valorReferencia: expect.any(Array) });
  // Limpieza
  delete window.__mock_handleImmediateParameterSave;
  global.fetch = origFetch;
  });
});
