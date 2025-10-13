import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import ClinicalHistory from '@/components/modules/patients/ClinicalHistory.jsx';
import { apiClient } from '@/lib/apiClient';

vi.mock('@/lib/apiClient', async (orig) => {
  const mod = await orig();
  return {
    ...mod,
    apiClient: {
      ...mod.apiClient,
      get: vi.fn(),
    }
  };
});

// Minimal AppDataProvider mock to inject detailed studies
// no-op
vi.mock('@/contexts/AppDataContext', async (orig) => {
  const real = await orig();
  return {
    ...real,
    useAppData: vi.fn(),
    AppDataProvider: ({ children }) => <>{children}</>,
  };
});

// Avoid framer-motion using matchMedia listeners in JSDOM
vi.mock('framer-motion', async () => {
  const React = await import('react');
  return {
    motion: {
      div: ({ children, ...rest }) => React.createElement('div', rest, children),
    },
  };
});

describe('ClinicalHistory reference ranges - Vitamin D parameter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('renders non-N/A Reference for 1,25-(OH)2 Vitamina D', async () => {
    // Detailed study catalog with parameter and ranges
    const studies = [
      {
        id: 'study-vitD',
        name: '1,25-(OH)2 Vitamina D',
        general_units: 'pg/mL',
        parameters: [
          {
            id: 'param-vitD',
            name: '1,25-(OH)2 Vitamina D',
            unit: 'pg/mL',
            reference_ranges: [
              { id: 1, sex: 'Ambos', age_min: 0, age_max: 120, age_min_unit: 'años', lower: 19, upper: 79, text_value: null }
            ]
          }
        ]
      }
    ];

    // Mock AppData
    const { useAppData } = await import('@/contexts/AppDataContext');
    useAppData.mockReturnValue({ studies, isLoading: false });

    // Mock API: aggregated history endpoint
    const historyPayload = {
      patient: { id: 'p1', full_name: 'Test', sex: 'Femenino', date_of_birth: '1990-01-01' },
      results: [
        {
          date: '2025-01-01', folio: 'F-1', studyId: 'study-vitD', studyName: '1,25-(OH)2 Vitamina D',
          parameterId: 'param-vitD', parameterName: '1,25-(OH)₂ Vitamina D', // note different unicode ₂
          result: '50', unit: 'pg/mL'
        }
      ],
      chartableParameters: ['1,25-(OH)2 Vitamina D']
    };

    apiClient.get.mockImplementation(async (path) => {
      if (/^\/patients\/p1\/history$/.test(path)) return historyPayload;
      if (/^\/patients\/p1$/.test(path)) return historyPayload.patient;
      if (path === '/work-orders') return [];
      throw new Error('unexpected GET ' + path);
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/patients/p1/history' }]}>
        <Routes>
          <Route path="/patients/:patientId/history" element={<ClinicalHistory />} />
        </Routes>
      </MemoryRouter>
    );

  // Expect reference text with correct range and unit visible somewhere in the table
  const ref = await screen.findByText(/19\s*-\s*79\s*pg\/mL/i);
  expect(ref).toBeInTheDocument();
  });
});
