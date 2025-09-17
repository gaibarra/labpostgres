
import React from 'react';
import { Badge } from '@/components/ui/badge';

// Normaliza un objeto de valor de referencia a la nueva convención camel_case inglesa
function normalizeRef(v) {
  if (!v) return {};
  return {
    gender: (() => {
      const g = (v.gender || v.sexo || 'Ambos').toString().trim().toLowerCase();
      if (g.startsWith('masc')) return 'Masculino';
      if (g.startsWith('fem')) return 'Femenino';
      return 'Ambos';
    })(),
    age_min: v.age_min ?? v.edadMin ?? null,
    age_max: v.age_max ?? v.edadMax ?? null,
    age_unit: v.age_unit || v.unidadEdad || 'años',
    normal_min: v.normal_min ?? v.valorMin ?? null,
    normal_max: v.normal_max ?? v.valorMax ?? null,
    tipoValor: v.tipoValor || (v.textoLibre ? 'textoLibre' : (v.textoPermitido ? 'alfanumerico' : 'numerico')),
    textoPermitido: v.textoPermitido || '',
    textoLibre: v.textoLibre || '',
    notas: v.notas || '',
  };
}

const ReferenceValueSummary = ({ values }) => {
  if (!values || values.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin definir</span>;
  }

  // Combina entradas con mismo rango/valores donde existan Masculino y Femenino idénticos -> 'Ambos'
  const combineMF = (rawValues) => {
    const groups = new Map();
    rawValues.forEach(v => {
      const n = normalizeRef(v);
      const key = [
        n.age_min ?? '',
        n.age_max ?? '',
        n.age_unit ?? '',
        n.tipoValor ?? '',
        n.normal_min ?? '',
        n.normal_max ?? '',
        n.textoPermitido ?? '',
        n.textoLibre ?? '',
        n.notas ?? ''
      ].join('|');
      if (!groups.has(key)) groups.set(key, { items: [], genders: new Set(), sample: n });
      const g = groups.get(key);
      g.items.push(n);
      g.genders.add(n.gender);
    });
    const merged = [];
    groups.forEach(g => {
      // Si ya existe 'Ambos' dejamos sólo esa.
      if (g.genders.has('Ambos')) {
        merged.push(g.items.find(i => i.gender === 'Ambos'));
        return;
      }
      if (g.genders.has('Masculino') && g.genders.has('Femenino')) {
        // Crear combinación
        merged.push({ ...g.sample, gender: 'Ambos' });
      } else {
        merged.push(...g.items);
      }
    });
    return merged;
  };

  const combinedValues = combineMF(values);

  const summarizeValue = (raw) => {
    const ref = normalizeRef(raw);
    const { gender, age_min, age_max, age_unit, normal_min, normal_max, tipoValor, textoPermitido, textoLibre } = ref;
    let sexText = 'Ambos';
  if (gender === 'Masculino' || gender === 'masculino' || gender === 'M') sexText = 'M';
  if (gender === 'Femenino' || gender === 'femenino' || gender === 'F') sexText = 'F';

    let ageText = '';
    if (age_min != null && age_max != null) ageText = `${age_min}-${age_max} ${age_unit}`;
    else if (age_min != null) ageText = `>= ${age_min} ${age_unit}`;
    else if (age_max != null) ageText = `<= ${age_max} ${age_unit}`;

    let valueText = '';
    if (tipoValor === 'numerico') {
      if (normal_min != null && normal_max != null) valueText = `${normal_min} - ${normal_max}`;
      else if (normal_min != null) valueText = `>= ${normal_min}`;
      else if (normal_max != null) valueText = `<= ${normal_max}`;
      else valueText = 'N/A';
    } else if (tipoValor === 'alfanumerico') {
      valueText = textoPermitido || 'N/A';
    } else if (tipoValor === 'textoLibre') {
      valueText = textoLibre ? (textoLibre.length > 25 ? `${textoLibre.slice(0,25)}…` : textoLibre) : 'N/A';
    } else {
      valueText = 'N/A';
    }

    const fullAgeText = ageText ? `, ${ageText}` : '';
    return `(${sexText}${fullAgeText}): ${valueText}`;
  };

  // Mostrar todos los resúmenes (sin truncar ni badge de "+n más...")
  return (
    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
      {combinedValues.map((v, idx) => (
        <span key={idx} className="text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">{summarizeValue(v)}</span>
      ))}
    </div>
  );
};

export default ReferenceValueSummary;
