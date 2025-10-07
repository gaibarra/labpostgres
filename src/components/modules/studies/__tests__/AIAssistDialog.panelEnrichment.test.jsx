import React from 'react';
import { describe, test, afterEach, vi, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistDialog from '../AIAssistDialog';

// Vitest globals (vi) instead of jest
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

describe('AIAssistDialog panel enrichment', () => {
  afterEach(() => { vi.clearAllMocks(); });

  test('genera panel completo para Biometría Hemática (≈20 parámetros con rangos canónicos)', async () => {
  const onGenerationSuccess = vi.fn();
    // 1) Job de estudio
  apiClient.post.mockImplementationOnce(async (url, _body) => {
      if (url === '/ai/generate-study-details/async') return { jobId: 'job_study_1' };
      throw new Error('Unexpected POST first');
    });

    // 2) Polling del job de estudio -> done con payload mínimo (sin parámetros o muy pocos)
    apiClient.get.mockImplementationOnce(async (url) => {
      if (url === '/ai/generate-study-details/job/job_study_1') {
        return {
          status: 'done',
          progress: 100,
          message: 'ok',
          result: {
            name: 'Biometría Hemática',
            parameters: [ { name: 'Hemoglobina', unit: 'g/dL', decimal_places: 1, valorReferencia: [] } ]
          }
        };
      }
      throw new Error('Unexpected GET first');
    });

    // 3) POST panel async
  apiClient.post.mockImplementationOnce(async (url, _body) => {
      if (url === '/ai/generate-panel/async') return { jobId: 'job_panel_1' };
      throw new Error('Unexpected POST panel');
    });

    // 4) Panel polling (varias llamadas hasta done)
    const panelResponses = [
      { status:'working', progress:25, message:'generando Hemoglobina' },
      { status:'working', progress:55, message:'generando Eritrocitos' },
      { status:'done', progress:100, message:'Completado', result: {
          parameters: [
            { name:'Hemoglobina', unit:'g/dL', decimal_places:1, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:13.5, valorMax:20 } ] },
            { name:'Hematocrito', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:42, valorMax:65 } ] },
            { name:'Eritrocitos', unit:'x10^6/µL', decimal_places:2, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:4.0, valorMax:6.6 } ] },
            { name:'VCM', unit:'fL', decimal_places:1, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:95, valorMax:120 } ] },
            { name:'HCM', unit:'pg', decimal_places:1, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:30, valorMax:37 } ] },
            { name:'CHCM', unit:'g/dL', decimal_places:1, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:30, valorMax:36 } ] },
            { name:'RDW', unit:'%', decimal_places:1, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:11.5, valorMax:14.5 } ] },
            { name:'Plaquetas', unit:'x10^3/µL', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:150, valorMax:450 } ] },
            { name:'VMP', unit:'fL', decimal_places:1, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:7.0, valorMax:11.0 } ] },
            { name:'Leucocitos Totales', unit:'x10^3/µL', decimal_places:1, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:9.0, valorMax:30.0 } ] },
            { name:'Neutrófilos Segmentados', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:50, valorMax:70 } ] },
            { name:'Neutrófilos Banda', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:0, valorMax:10 } ] },
            { name:'Linfocitos', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:20, valorMax:40 } ] },
            { name:'Monocitos', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:2, valorMax:12 } ] },
            { name:'Eosinófilos', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:0, valorMax:5 } ] },
            { name:'Basófilos', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:0, valorMax:1 } ] },
            { name:'Blastos', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:0, valorMax:0 } ] },
            { name:'Metamielocitos', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:0, valorMax:0 } ] },
            { name:'Mielocitos', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:0, valorMax:0 } ] },
            { name:'Promielocitos', unit:'%', decimal_places:0, valorReferencia: [ { sexo:'Ambos', edadMin:0, edadMax:1, unidadEdad:'años', valorMin:0, valorMax:0 } ] }
          ]
        }}
    ];
    let panelCall = 0;
    apiClient.get.mockImplementation((url) => {
      if (url === '/ai/generate-panel/job/job_panel_1') {
        const resp = panelResponses[Math.min(panelCall, panelResponses.length-1)];
        panelCall++;
        return resp;
      }
      // La primera implementación de get (job study) ya fue usada arriba, así que cualquier otra es panel
      return panelResponses[panelResponses.length-1];
    });

    render(<AIAssistDialog isOpen={true} onOpenChange={()=>{}} onGenerationSuccess={onGenerationSuccess} />);

  // Escribir nombre estudio (puede haber más de un label "Estudio" montado por Radix / portals)
  const user = userEvent.setup();
  const estudioInput = document.getElementById('study-name');
  await user.type(estudioInput, 'Biometría Hemática', { delay: 0 });

  // Esperar a que la configuración (apiKey) cargue y el botón esté habilitado
  const generarBtn = screen.getByRole('button', { name: /Generar Detalles/i });
  await waitFor(()=> expect(generarBtn).not.toBeDisabled(), { timeout: 5000 });
  fireEvent.click(generarBtn);

  await waitFor(()=> expect(onGenerationSuccess).toHaveBeenCalled(), { timeout: 20000 });

    const payload = onGenerationSuccess.mock.calls[0][0];
    expect(payload.name).toMatch(/Biometría Hemática/i);
    // Debe contener ~20 parámetros
    expect(payload.parameters.length).toBeGreaterThanOrEqual(20);
    // Verificar algunos clave
    const names = payload.parameters.map(p=>p.name);
    ['Hemoglobina','Hematocrito','Eritrocitos','Plaquetas','Leucocitos Totales','Neutrófilos Segmentados','Promielocitos'].forEach(n=>{
      expect(names).toContain(n);
    });
    // Verificar que cada parámetro tenga al menos un rango
    payload.parameters.forEach(p=>{
      expect(Array.isArray(p.valorReferencia)).toBe(true);
      expect(p.valorReferencia.length).toBeGreaterThan(0);
    });
  }, 25000);
});
