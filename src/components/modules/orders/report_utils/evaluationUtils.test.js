import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEvaluationUtils } from './evaluationUtils.js';

// Fixed 'today' for deterministic age calculations (mock Date)
const REAL_DATE = Date;
function mockToday(iso){
  const Fixed = class extends REAL_DATE {
    constructor(arg){
      if (arg) {
        super(arg);
      } else {
        super(iso);
      }
    }
    static now(){ return new REAL_DATE(iso).getTime(); }
  };
  global.Date = Fixed;
}

describe('evaluationUtils - getApplicableReference', () => {
  beforeAll(() => {
    mockToday('2025-10-04T12:00:00Z');
  });
  afterAll(() => {
    global.Date = REAL_DATE;
  });

  const patientFemale = { date_of_birth: '1979-09-15', sex: 'F' }; // 46 años aprox en fecha mock
  const patientMaleMonths = { date_of_birth: '2025-08-04', sex: 'M' }; // 2 meses
  const patientNewbornHours = { date_of_birth: '2025-10-03T15:00:00Z', sex: 'M' }; // ~21 horas

  it('selecciona rango Ambos cuando coincide edad en años', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = {
      reference_ranges: [
        { sex: 'Ambos', age_min: 0, age_max: 120, age_min_unit: 'años', lower: 10, upper: 20 }
      ]
    };
    const ref = result.current.getApplicableReference(param, patientFemale);
    expect(ref).toBeTruthy();
    expect(ref.lower).toBe(10);
  });

  it('prefiere rango específico de sexo sobre Ambos si ambos aplican (primer match en array)', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = {
      reference_ranges: [
        { sex: 'Ambos', age_min: 0, age_max: 120, age_min_unit: 'años', lower: 10, upper: 20 },
        { sex: 'Femenino', age_min: 40, age_max: 60, age_min_unit: 'años', lower: 12, upper: 18 }
      ]
    };
    const ref = result.current.getApplicableReference(param, patientFemale);
    expect(ref.sex).toBe('Femenino');
  });

  it('normaliza sexo m/f/a para coincidencia', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = { reference_ranges: [{ sex: 'Femenino', age_min: 40, age_max: 60, age_min_unit: 'años', lower: 1, upper: 2 }] };
    const ref = result.current.getApplicableReference(param, { ...patientFemale, sex: 'f' });
    expect(ref).toBeTruthy();
  });

  it('maneja unidades en meses para lactantes', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = { reference_ranges: [{ sex: 'Masculino', age_min: 0, age_max: 6, age_min_unit: 'meses', lower: 5, upper: 9 }] };
    const ref = result.current.getApplicableReference(param, patientMaleMonths);
    expect(ref).toBeTruthy();
    expect(ref.lower).toBe(5);
  });

  it('maneja unidades en horas para recién nacidos', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = { reference_ranges: [{ sex: 'Masculino', age_min: 0, age_max: 48, age_min_unit: 'horas', lower: 1, upper: 3 }] };
    const ref = result.current.getApplicableReference(param, patientNewbornHours);
    expect(ref).toBeTruthy();
  });

  it('retorna null si edad fuera de rango', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = { reference_ranges: [{ sex: 'Femenino', age_min: 0, age_max: 30, age_min_unit: 'años', lower: 1, upper: 2 }] };
    const ref = result.current.getApplicableReference(param, patientFemale);
    expect(ref).toBeNull();
  });

  it('retorna null si patient sin sexo', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = { reference_ranges: [{ sex: 'Ambos', age_min: 0, age_max: 120, age_min_unit: 'años', lower: 1, upper: 2 }] };
    const ref = result.current.getApplicableReference(param, { date_of_birth: patientFemale.date_of_birth });
    expect(ref).toBeNull();
  });
});

describe('evaluationUtils - getReferenceRangeText', () => {
  beforeAll(() => { mockToday('2025-10-04T12:00:00Z'); });
  afterAll(() => { global.Date = REAL_DATE; });

  it('formatea texto numérico con unidades y demografía', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const patient = { date_of_birth: '1985-10-01', sex: 'F' };
    const param = { unit: 'g/dL', reference_ranges: [{ sex: 'Femenino', age_min: 30, age_max: 60, age_min_unit: 'años', lower: 12, upper: 15 }] };
    const txt = result.current.getReferenceRangeText(param, patient);
    expect(txt).toMatch(/12 - 15 g\/dL/);
    expect(txt).toMatch(/Femenino/);
  });

  it('omite el placeholder "(Texto libre)" al construir la referencia', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const patient = { date_of_birth: '1995-05-05', sex: 'F' };
    const param = {
      reference_ranges: [
        { sex: 'Ambos', age_min: 0, age_max: 120, age_min_unit: 'años', text_value: '(Texto libre)' }
      ]
    };
    const refObject = result.current.getReferenceRangeText(param, patient, undefined, true);
    expect(refObject.valueText || '').not.toMatch(/texto libre/i);
    const refString = result.current.getReferenceRangeText(param, patient);
    expect(refString.toLowerCase()).not.toContain('texto libre');
  });
});

describe('evaluationUtils - evaluateResult', () => {
  beforeAll(() => { mockToday('2025-10-04T12:00:00Z'); });
  afterAll(() => { global.Date = REAL_DATE; });

  const patient = { date_of_birth: '1990-01-01', sex: 'M' };

  const buildParam = (lower, upper, extra = {}) => ({
    reference_ranges: [{ sex: 'Masculino', age_min: 0, age_max: 120, age_min_unit: 'años', lower, upper, ...extra }]
  });

  it('retorna normal cuando valor dentro de rango inclusivo', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = buildParam(10, 20);
    expect(result.current.evaluateResult('10', param, patient)).toBe('normal'); // límite inferior
    expect(result.current.evaluateResult('15', param, patient)).toBe('normal'); // medio
    expect(result.current.evaluateResult('20', param, patient)).toBe('normal'); // límite superior
  });

  it('retorna bajo cuando valor < lower', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = buildParam(10, 20);
    expect(result.current.evaluateResult('9.9', param, patient)).toBe('bajo');
  });

  it('retorna alto cuando valor > upper', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = buildParam(10, 20);
    expect(result.current.evaluateResult('20.1', param, patient)).toBe('alto');
  });

  it('maneja rango open-ended inferior (lower null) => solo valida upper', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    // Simular lower null usando -Infinity vía limpieza
    const param = { reference_ranges: [{ sex: 'Masculino', age_min: 0, age_max: 120, age_min_unit: 'años', lower: null, upper: 5 }] };
    expect(result.current.evaluateResult('1', param, patient)).toBe('normal');
    expect(result.current.evaluateResult('6', param, patient)).toBe('alto');
  });

  it('maneja rango open-ended superior (upper null) => solo valida lower', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = { reference_ranges: [{ sex: 'Masculino', age_min: 0, age_max: 120, age_min_unit: 'años', lower: 50, upper: null }] };
    expect(result.current.evaluateResult('49', param, patient)).toBe('bajo');
    expect(result.current.evaluateResult('50', param, patient)).toBe('normal');
  });

  it('retorna no-numerico cuando input no parsea y rango numérico', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = buildParam(1, 2);
    expect(result.current.evaluateResult('abc', param, patient)).toBe('no-numerico');
  });

  it('retorna normal cuando text_value presente (cualquier input)', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = { reference_ranges: [{ sex: 'Masculino', age_min: 0, age_max: 120, age_min_unit: 'años', text_value: 'Negativo' }] };
    expect(result.current.evaluateResult('lo que sea', param, patient)).toBe('normal');
  });

  it('retorna no-evaluable cuando no hay rango aplicable', () => {
    const { result } = renderHook(() => useEvaluationUtils());
    const param = { reference_ranges: [{ sex: 'Femenino', age_min: 0, age_max: 120, age_min_unit: 'años', lower: 1, upper: 2 }] };
    expect(result.current.evaluateResult('1.5', param, patient)).toBe('no-evaluable');
  });
});
