import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
// NOTA: no importar '@testing-library/jest-dom' aquí; ya se carga en setupTests.js usando la versión /vitest.
import ReportStudySection from './ReportStudySection.jsx';

// Mocks simples
const mockEvaluateResult = () => 'normal';
const mockGetReferenceRangeText = () => ({ valueText: '0 - 10', demographics: 'Ambos' });

/**
 * Este test valida que ReportStudySection asocia resultados aunque exista diferencia de tipos
 * entre los IDs de parámetros (string vs UUID vs number), gracias a la normalización String().
 */

describe('ReportStudySection ID normalization', () => {
  test('mapea resultados con parametroId string y param.id UUID/number', () => {
    const studyDetail = {
      id: 'study-123',
      name: 'Perfil Cardíaco',
      general_units: 'ng/mL',
      parameters: [
        { id: '11111111-1111-1111-1111-111111111111', name: 'Troponina I', unit: 'ng/mL', reference_ranges: [] },
        { id: 2002, name: 'CK Total', unit: 'U/L', reference_ranges: [] },
        { id: 'param-3', name: 'CK-MB', unit: 'ng/mL', reference_ranges: [] }
      ]
    };

    const orderResults = [
      { parametroId: '11111111-1111-1111-1111-111111111111', valor: '0.02' }, // string vs string
      { parametroId: '2002', valor: '145' }, // string vs number
      { parametroId: 'param-3', valor: '3.5' }
    ];

    render(
      <ReportStudySection
        studyDetail={studyDetail}
        orderResults={orderResults}
        patient={{ id: 'p1' }}
        getReferenceRangeText={mockGetReferenceRangeText}
        evaluateResult={mockEvaluateResult}
        patientAgeData={{ ageYears: 50 }}
      />
    );

    // Deben mostrarse los tres valores y no "PENDIENTE"
    expect(screen.getByText('0.02')).toBeInTheDocument();
    expect(screen.getByText('145')).toBeInTheDocument();
    expect(screen.getByText('3.5')).toBeInTheDocument();
    // Asegurar que el placeholder "PENDIENTE" no aparece (caso de false negative)
    expect(screen.queryByText(/PENDIENTE/i)).not.toBeInTheDocument();
  });

  test('muestra PENDIENTE cuando un parámetro no tiene resultado', () => {
    const studyDetail = {
      id: 'study-456',
      name: 'Perfil Metabólico',
      general_units: '',
      parameters: [
        { id: 'p-glucosa', name: 'Glucosa', unit: 'mg/dL', reference_ranges: [] },
        { id: 'p-colesterol', name: 'Colesterol', unit: 'mg/dL', reference_ranges: [] }
      ]
    };
    const orderResults = [
      { parametroId: 'p-glucosa', valor: '90' }
      // Falta colesterol deliberadamente
    ];

    render(
      <ReportStudySection
        studyDetail={studyDetail}
        orderResults={orderResults}
        patient={{ id: 'p1' }}
        getReferenceRangeText={mockGetReferenceRangeText}
        evaluateResult={mockEvaluateResult}
        patientAgeData={{ ageYears: 40 }}
      />
    );

    expect(screen.getByText('90')).toBeInTheDocument();
    // Debe existir exactamente un placeholder PENDIENTE (para colesterol)
    expect(screen.getAllByText(/PENDIENTE/i)).toHaveLength(1);
  });
});
