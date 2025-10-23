import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import CBCReportLayout from '@/components/modules/orders/report_utils/CBCReportLayout.jsx';

// Utilidad para encontrar una fila por el nombre del parámetro
const getRowByParam = (paramName) => {
  const cell = screen.getByText(paramName);
  // subimos al <tr>
  return cell.closest('tr');
};

describe('CBCReportLayout - Serie Blanca (previsualización)', () => {
  beforeEach(() => { /* no-op */ });
  afterEach(() => cleanup());

  const baseStudy = {
    id: 'study-cbc-1',
    name: 'Biometría Hemática',
    general_units: '10^3/uL',
    parameters: [
      { id: 'wbc', name: 'Leucocitos Totales', unit: '10^3/uL' },
      { id: 'neut', name: 'Neutrófilos %', unit: '%' },
      { id: 'linf', name: 'Linfocitos', unit: '10^3/uL' },
    ],
  };

  const baseResults = [
    { parametroId: 'wbc', valor: '8.0' }, // 8.0 x10^3/uL
    { parametroId: 'neut', valor: '60' }, // 60%
    { parametroId: 'linf', valor: '2.0' }, // 2.0 x10^3/uL
  ];

  const renderResultCell = (value /*, meta*/) => (
    <span data-testid="result-cell">{String(value)}</span>
  );

  const getReferenceRangeText = (param /*, patient, ageData, collapsed*/) => {
    const name = String(param?.name || '').toLowerCase();
    if (name.includes('neutrófilos') || name.includes('neutrofilos')) {
      return { valueText: '40–60', demographics: 'Adulto Mujer' };
    }
    if (name.includes('linfocitos')) {
      return { valueText: '1.0–4.0', demographics: 'Adulto' };
    }
    if (name.includes('leucocitos')) {
      return { valueText: '4.0–10.0', demographics: 'Adulto' };
    }
    return { valueText: 'N/A', demographics: '' };
  };

  it('muestra el Absoluto derivado cuando hay % y Leucocitos Totales', () => {
    render(
      <CBCReportLayout
        studyDetail={baseStudy}
        orderResults={baseResults}
        renderResultCell={renderResultCell}
        getReferenceRangeText={getReferenceRangeText}
        patient={{}}
        patientAgeData={{}}
      />
    );

    const neutRow = getRowByParam('Neutrófilos %');
    expect(neutRow).not.toBeNull();
    // En Absoluto debe mostrar 60% de 8.0 => 4.8 (con 1 decimal)
    const absCell = within(neutRow).getAllByRole('cell')[1];
    expect(absCell.textContent).toMatch(/4\.8/);

    // En la columna de Valores de Referencia se debe ver el rango con % y demografía
    const refCell = within(neutRow).getAllByRole('cell')[3];
    expect(refCell.textContent).toMatch(/40–60%/);
    expect(refCell.textContent).toMatch(/Adulto Mujer/);
  });

  it('muestra el % derivado cuando hay Absoluto y Leucocitos Totales', () => {
    render(
      <CBCReportLayout
        studyDetail={baseStudy}
        orderResults={baseResults}
        renderResultCell={renderResultCell}
        getReferenceRangeText={getReferenceRangeText}
        patient={{}}
        patientAgeData={{}}
      />
    );

    const linfRow = getRowByParam('Linfocitos');
    expect(linfRow).not.toBeNull();
    // 2.0 de 8.0 => 25%
    const pctCell = within(linfRow).getAllByRole('cell')[2];
    expect(pctCell.textContent).toMatch(/25/);

    // En la columna de Valores de Referencia se debe ver el rango sin % añadido
    const refCell = within(linfRow).getAllByRole('cell')[3];
    expect(refCell.textContent).toMatch(/1\.0–4\.0/);
    expect(refCell.textContent).toMatch(/Adulto/);
  });

  it('omite derivados cuando falta Leucocitos Totales', () => {
    const noTotalStudy = {
      ...baseStudy,
      parameters: baseStudy.parameters.filter(p => p.id !== 'wbc'),
    };
    const noTotalResults = baseResults.filter(r => r.parametroId !== 'wbc');

    render(
      <CBCReportLayout
        studyDetail={noTotalStudy}
        orderResults={noTotalResults}
        renderResultCell={renderResultCell}
        getReferenceRangeText={getReferenceRangeText}
        patient={{}}
        patientAgeData={{}}
      />
    );

    const neutRow = getRowByParam('Neutrófilos %');
    const absCell = within(neutRow).getAllByRole('cell')[1];
    // Debe contener un guión (—) indicando ausencia de derivado
    expect(absCell.textContent).toMatch(/—/);

    const linfRow = getRowByParam('Linfocitos');
    const pctCell = within(linfRow).getAllByRole('cell')[2];
    expect(pctCell.textContent).toMatch(/—/);
  });
});
