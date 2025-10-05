import { useCallback } from 'react';

    export const useEvaluationUtils = () => {
      const calculateAgeInUnits = useCallback((birthDateStr) => {
        if (!birthDateStr) return { ageYears: 0, unit: 'años', fullMonths: 0, fullDays: 0, fullWeeks: 0, fullHours: 0 };
        const birthDate = new Date(birthDateStr);
        const today = new Date();

        let ageYears = today.getFullYear() - birthDate.getFullYear();
        let monthDiff = today.getMonth() - birthDate.getMonth();
        let dayDiff = today.getDate() - birthDate.getDate();

        if (dayDiff < 0) {
          monthDiff--;
          const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
          dayDiff += lastMonth.getDate();
        }
        if (monthDiff < 0) {
          ageYears--;
          monthDiff += 12;
        }
        
        const fullMonths = ageYears * 12 + monthDiff;
        const diffTime = Math.abs(today.getTime() - birthDate.getTime());
        const fullDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const fullWeeks = Math.floor(fullDays / 7);
        const fullHours = Math.floor(diffTime / (1000 * 60 * 60));

        return { ageYears, unit: 'años', fullMonths, fullDays, fullWeeks, fullHours };
      }, []);

      const getApplicableReference = useCallback((param, patientData, patientAgeDataHook) => {
        if (!param || !param.reference_ranges || param.reference_ranges.length === 0 || !patientData?.date_of_birth || !patientData?.sex) {
          return null;
        }
        
        const patientAgeDataToUse = patientAgeDataHook || calculateAgeInUnits(patientData.date_of_birth);

        const cleanedValoresReferencia = param.reference_ranges.map(vr => ({
          ...vr,
          age_min: vr.age_min === null || vr.age_min === undefined || isNaN(parseFloat(vr.age_min)) ? -Infinity : parseFloat(vr.age_min),
          age_max: vr.age_max === null || vr.age_max === undefined || isNaN(parseFloat(vr.age_max)) ? Infinity : parseFloat(vr.age_max),
          lower: vr.lower === null || vr.lower === undefined || isNaN(parseFloat(vr.lower)) ? -Infinity : parseFloat(vr.lower),
          upper: vr.upper === null || vr.upper === undefined || isNaN(parseFloat(vr.upper)) ? Infinity : parseFloat(vr.upper),
          age_min_unit: vr.age_min_unit || 'años',
          text_value: vr.text_value,
        }));

        const norm = (v)=>{
          if(!v) return '';
          const s=String(v).toLowerCase();
            if(s.startsWith('m')) return 'masculino';
            if(s.startsWith('f')) return 'femenino';
            if(s.startsWith('a')) return 'ambos';
            if(['ambos','masculino','femenino'].includes(s)) return s;
            return s; // fallback
        };
        const patientSexNorm = norm(patientData.sex);
        // Filtrar candidatos que coincidan por sexo y edad
        const candidates = cleanedValoresReferencia.filter(vr => {
          const rangeSexNorm = norm(vr.sex);
          if (!(rangeSexNorm === 'ambos' || rangeSexNorm === patientSexNorm)) return false;
          let ageComparisonValue;
          switch (vr.age_min_unit) {
            case 'horas': ageComparisonValue = patientAgeDataToUse.fullHours; break;
            case 'dias': ageComparisonValue = patientAgeDataToUse.fullDays; break;
            case 'semanas': ageComparisonValue = patientAgeDataToUse.fullWeeks; break;
            case 'meses': ageComparisonValue = patientAgeDataToUse.fullMonths; break;
            case 'años':
            default: ageComparisonValue = patientAgeDataToUse.ageYears; 
          }
          return ageComparisonValue >= vr.age_min && ageComparisonValue <= vr.age_max;
        });
        if (!candidates.length) return null;
        // Listar exactos
        const exactCandidates = candidates.filter(vr => norm(vr.sex) === patientSexNorm);
        if (exactCandidates.length > 1) {
          try {
            console.warn('[REF-RANGE][AMBIGUO] Múltiples rangos exactos aplican', {
              parameterId: param?.id,
              sex: patientSexNorm,
              count: exactCandidates.length,
              ranges: exactCandidates.map(r => ({ id: r.id, age_min: r.age_min, age_max: r.age_max, unit: r.age_min_unit }))
            });
          } catch(_) {}
        }
        if (exactCandidates.length) return exactCandidates[0];
        return candidates[0];
      }, [calculateAgeInUnits]);

      const getReferenceRangeText = useCallback((param, patientData, patientAgeDataHook, returnObject = false) => {
        const applicableRef = getApplicableReference(param, patientData, patientAgeDataHook);
        if (!applicableRef) {
          return returnObject ? { valueText: 'N/A', demographics: '' } : 'N/A';
        }
        
        const vrUnidadEdad = applicableRef.age_min_unit || 'años';
        let ageText = '';
        
        const minAgeIsNull = applicableRef.age_min === -Infinity;
        const maxAgeIsNull = applicableRef.age_max === Infinity;

        if (minAgeIsNull && maxAgeIsNull) {
          ageText = 'Todas las edades';
        } else if (minAgeIsNull) {
          ageText = `≤ ${applicableRef.age_max} ${vrUnidadEdad}`;
        } else if (maxAgeIsNull) {
          ageText = `≥ ${applicableRef.age_min} ${vrUnidadEdad}`;
        } else {
          ageText = `${applicableRef.age_min}-${applicableRef.age_max} ${vrUnidadEdad}`;
        }

        const demographics = `(${applicableRef.sex || 'Ambos'}, ${ageText})`;
        
        let valueText = '';
        if (applicableRef.text_value) {
          valueText = applicableRef.text_value;
        } else {
          const minValIsNull = applicableRef.lower === -Infinity;
          const maxValIsNull = applicableRef.upper === Infinity;

          if (minValIsNull && maxValIsNull) {
            valueText = 'No aplica'; 
          } else if (minValIsNull) {
            valueText = `≤ ${applicableRef.upper}`;
          } else if (maxValIsNull) {
            valueText = `≥ ${applicableRef.lower}`;
          } else {
            valueText = `${applicableRef.lower} - ${applicableRef.upper}`;
          }
        }
        
        const units = param.unit || '';
        const fullValueText = `${valueText}${units ? ' ' + units : ''}`;

        if (returnObject) {
          return { valueText: fullValueText, demographics };
        }

        return `${fullValueText} ${demographics}`;
      }, [getApplicableReference]);

      const evaluateResult = useCallback((inputValue, param, patientData, patientAgeDataHook) => {
        const applicableRef = getApplicableReference(param, patientData, patientAgeDataHook);
        if (!applicableRef) return 'no-evaluable';

        if (applicableRef.text_value) {
          return 'normal';
        }

        const value = parseFloat(inputValue);
        if (isNaN(value)) return 'no-numerico';

        const min = applicableRef.lower; 
        const max = applicableRef.upper;

        if (min === -Infinity && max === Infinity) return 'normal'; 
        if (min === -Infinity && value > max) return 'alto';
        if (max === Infinity && value < min) return 'bajo';

        if (value < min) return 'bajo';
        if (value > max) return 'alto';
        
        return 'normal'; 
      }, [getApplicableReference]);

      return { calculateAgeInUnits, getApplicableReference, getReferenceRangeText, evaluateResult };
    };