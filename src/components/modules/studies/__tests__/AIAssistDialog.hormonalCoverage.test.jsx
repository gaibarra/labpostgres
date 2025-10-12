import React from 'react';
import { describe, test, afterEach, vi, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistDialog from '../AIAssistDialog';

// Mocks requeridos
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ settings: { integrations: { openaiApiKey: 'sk-test' } } }) }));
vi.mock('@/lib/apiClient', () => ({
  __esModule: true,
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

import apiClient from '@/lib/apiClient';

describe('AIAssistDialog coverage genérico', () => {
  afterEach(() => { vi.clearAllMocks(); });

  test('Completa cobertura 0–120 para parámetros no hormonales (Glucosa/Colesterol)', async () => {
    const onGenerationSuccess = vi.fn();

    // 1) Crear job de estudio
    apiClient.post.mockImplementationOnce(async (url, _body) => {
      if (url === '/ai/generate-study-details/async') return { jobId: 'job_study_h1' };
      throw new Error('Unexpected POST first');
    });

    // 2) Poll del job: resultado inicial con rangos incompletos
    apiClient.get.mockImplementationOnce(async (url) => {
      if (url === '/ai/generate-study-details/job/job_study_h1') {
        return {
          status: 'done',
          progress: 100,
          message: 'ok',
          result: {
            name: 'Perfil tiroideo',
            parameters: [
              {
                name: 'Glucosa', unit: 'mg/dL', decimal_places: 0,
                valorReferencia: [
                  // Solo un tramo adulto masculino -> debe completar pediátrico Ambos y adulto por sexo
                  { sexo:'Masculino', edadMin:18, edadMax:65, unidadEdad:'años', valorMin:70, valorMax:100 }
                ]
              },
              {
                name: 'Colesterol Total', unit: 'mg/dL', decimal_places: 0,
                valorReferencia: [
                  // Un tramo adolescente Ambos -> debe completar 0–12 Ambos y adultos Ambos
                  { sexo:'Ambos', edadMin:12, edadMax:18, unidadEdad:'años', valorMin:120, valorMax:200 }
                ]
              }
            ]
          }
        };
      }
      throw new Error('Unexpected GET first');
    });

    // 3) No se dispara panel enrichment (alreadyLooksComplete falso y canonicalMatch verdadero, pero no vamos a mockear panel);
    // Dejar cualquier otra llamada GET devolver el mismo objeto (no debería ocurrir en este flujo)
    apiClient.get.mockImplementation((_url) => {
      return { status: 'done', progress: 100, message: 'ok', result: { parameters: [] } };
    });

    render(<AIAssistDialog isOpen={true} onOpenChange={()=>{}} onGenerationSuccess={onGenerationSuccess} />);

    const user = userEvent.setup();
    const estudioInput = document.getElementById('study-name');
  await user.type(estudioInput, 'Perfil tiroideo', { delay: 0 });

    const generarBtn = screen.getByRole('button', { name: /Generar Detalles/i });
    await waitFor(()=> expect(generarBtn).not.toBeDisabled(), { timeout: 5000 });
    fireEvent.click(generarBtn);

    await waitFor(()=> expect(onGenerationSuccess).toHaveBeenCalled(), { timeout: 20000 });

    const payload = onGenerationSuccess.mock.calls[0][0];
  expect(payload.name).toMatch(/Perfil tiroideo/i);

    const byName = Object.fromEntries(payload.parameters.map(p => [p.name.toLowerCase(), p]));
  expect(byName['glucosa']).toBeTruthy();
  expect(byName['colesterol total']).toBeTruthy();

    const segs = [[0,1],[1,2],[2,12],[12,18],[18,65],[65,120]];

  // Glucosa: debe tener pediátrico Ambos y adulto por sexo (Masculino y Femenino) en 12–18,18–65,65–120
  const t = byName['glucosa'];
    const tRefs = t.valorReferencia;
    // pediátrico Ambos
    for (const [a,b] of segs.slice(0,3)) {
      expect(tRefs.some(r => r.edadMin===a && r.edadMax===b && (r.sexo||'Ambos')==='Ambos')).toBe(true);
    }
    // adolescentes/adultos por sexo
    for (const [a,b] of segs.slice(3)) {
      expect(tRefs.some(r => r.edadMin===a && r.edadMax===b && r.sexo==='Masculino')).toBe(true);
      expect(tRefs.some(r => r.edadMin===a && r.edadMax===b && r.sexo==='Femenino')).toBe(true);
    }

  // Colesterol Total: sin sexos específicos -> debe completar todo como Ambos
  const e = byName['colesterol total'];
    const eRefs = e.valorReferencia;
    for (const [a,b] of segs) {
      expect(eRefs.some(r => r.edadMin===a && r.edadMax===b && (r.sexo||'Ambos')==='Ambos')).toBe(true);
    }
  }, 25000);
});
