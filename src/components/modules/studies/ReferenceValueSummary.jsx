
import React from 'react';

// Normaliza un objeto de valor de referencia a la nueva convención camel_case inglesa
function normalizeRef(v) {
  if (!v) return {};
  // Campos base normalizados
  const gender = (() => {
    const g = (v.gender || v.sexo || 'Ambos').toString().trim().toLowerCase();
    if (g.startsWith('masc')) return 'Masculino';
    if (g.startsWith('fem')) return 'Femenino';
    return 'Ambos';
  })();
  const age_min = v.age_min ?? v.edadMin ?? null;
  const age_max = v.age_max ?? v.edadMax ?? null;
  const age_unit = v.age_unit || v.unidadEdad || 'años';
  const normal_min = v.normal_min ?? v.valorMin ?? v.lower ?? null;
  const normal_max = v.normal_max ?? v.valorMax ?? v.upper ?? null;
  const textoPermitido = v.textoPermitido || '';
  const textoLibre = v.textoLibre || v.text_value || '';
  const notas = v.notas || '';

  // Determinar tipoValor con los campos ya normalizados (ANTES se hacía con el objeto crudo y fallaba)
  const tipoValor = v.tipoValor || (
    textoLibre
      ? 'textoLibre'
      : (textoPermitido
          ? 'alfanumerico'
          : ((normal_min != null || normal_max != null)
              ? 'numerico'
              : 'textoLibre'))
  );

  return {
    gender,
    age_min,
    age_max,
    age_unit,
    normal_min,
    normal_max,
    tipoValor,
    textoPermitido,
    textoLibre,
    notas,
  };
}

const ReferenceValueSummary = ({ values, decimalPlaces }) => {
  if (!values || values.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin definir</span>;
  }

  // Modo B: mostrar rangos reales en orden, solo colapsar cuando M y F son idénticos (mismo intervalo y valores).
  const collapseIdenticalSexPairs = (rawValues) => {
    const byInterval = new Map();
    rawValues.forEach(v => {
      const n = normalizeRef(v);
      const key = [n.age_min ?? '', n.age_max ?? '', n.age_unit ?? '', n.normal_min ?? '', n.normal_max ?? '', n.tipoValor ?? '', n.textoPermitido ?? '', n.textoLibre ?? '', n.notas ?? ''].join('|');
      if (!byInterval.has(key)) byInterval.set(key, []);
      byInterval.get(key).push(n);
    });
    const out = [];
    byInterval.forEach(list => {
      const genders = new Set(list.map(l=>l.gender));
      if (genders.has('Ambos')) {
        // Mantener sólo 'Ambos'
        out.push(list.find(l=>l.gender==='Ambos'));
      } else if (genders.has('Masculino') && genders.has('Femenino') && list.length === 2) {
        // Colapsar a Ambos si ambos idénticos excepto gender
        const [a,b] = list;
        const same = ['age_min','age_max','age_unit','normal_min','normal_max','tipoValor','textoPermitido','textoLibre','notas']
          .every(k => a[k] === b[k]);
        if (same) out.push({ ...a, gender:'Ambos' }); else out.push(...list);
      } else {
        // Si todos son del mismo sexo pero duplicados exactos, conservar sólo el primero
        if (list.length > 1) {
          const g = list[0].gender;
          const allSameGender = list.every(l => l.gender === g);
          if (allSameGender) {
            out.push(list[0]);
          } else {
            out.push(...list);
          }
        } else {
          out.push(...list);
        }
      }
    });
    // Orden por edad y luego sexo
    return out.sort((a,b)=> (a.age_min??-1)-(b.age_min??-1) || (a.age_max??9999)-(b.age_max??9999) || a.gender.localeCompare(b.gender));
  };

  const combinedValues = collapseIdenticalSexPairs(values);

  // Detectar caso especial: todos los valores son placeholders sin datos reales -> mostrar una sola línea resumida
  // Detectar placeholders
  const maybeAllPlaceholders = combinedValues.length > 0 && combinedValues.every(v => {
    const n = normalizeRef(v);
    const noNums = (n.normal_min == null && n.normal_max == null);
    const noTexts = !n.textoLibre && !n.textoPermitido;
    const placeholderNote = (n.notas || '').match(/sin referencia establecida/i);
    return noNums && noTexts && placeholderNote;
  });
  // No colapsar si está la segmentación canónica completa (6 tramos) aunque sean placeholders
  const CANON_SEGS = [[0,1],[1,2],[2,12],[12,18],[18,65],[65,120]];
  const isCanonicalPlaceholderSet = maybeAllPlaceholders && combinedValues.length === CANON_SEGS.length &&
    CANON_SEGS.every(([a,b]) => combinedValues.some(v => {
      const n = normalizeRef(v);
      return n.gender === 'Ambos' && n.age_min === a && n.age_max === b && n.normal_min == null && n.normal_max == null;
    }));
  const allPlaceholders = maybeAllPlaceholders && !isCanonicalPlaceholderSet;
  if (allPlaceholders) {
    return (
      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap" title="Rangos aún no establecidos">(Ambos, 0-120 años): —</span>
      </div>
    );
  }

  const formatNumber = (num) => {
    if (num == null || num === '') return num;
    if (typeof decimalPlaces === 'number' && Number.isFinite(decimalPlaces)) {
      return Number(num).toFixed(decimalPlaces);
    }
    return num;
  };

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

    // NUEVA LÓGICA: si no hay ningún valor representable, retornamos null para ocultar la línea
    let valueText = null;
    if (tipoValor === 'numerico') {
      const fmin = formatNumber(normal_min);
      const fmax = formatNumber(normal_max);
      if (fmin != null && fmax != null) valueText = `${fmin} - ${fmax}`;
      else if (fmin != null) valueText = `>= ${fmin}`;
      else if (fmax != null) valueText = `<= ${fmax}`;
    } else if (tipoValor === 'alfanumerico') {
      if (textoPermitido) valueText = textoPermitido;
    } else if (tipoValor === 'textoLibre') {
      if (textoLibre) valueText = textoLibre.length > 25 ? `${textoLibre.slice(0,25)}…` : textoLibre;
    }

    if (valueText == null) {
      if (isCanonicalPlaceholderSet) {
        // Mostrar el tramo placeholder vacío
        let sexText = 'Ambos';
        if (gender === 'Masculino' || gender === 'masculino' || gender === 'M') sexText = 'M';
        if (gender === 'Femenino' || gender === 'femenino' || gender === 'F') sexText = 'F';
        const ageText = age_min != null && age_max != null ? `${age_min}-${age_max} ${age_unit}` : '';
        const fullAgeText = ageText ? `, ${ageText}` : '';
        return `(${sexText}${fullAgeText}): —`;
      }
      return null;
    }

    const fullAgeText = ageText ? `, ${ageText}` : '';
    return `(${sexText}${fullAgeText}): ${valueText}`;
  };

  // Mostrar todos los resúmenes (sin truncar ni badge de "+n más...")
  return (
    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
      {combinedValues.map((v, idx) => {
        const line = summarizeValue(v);
        if (!line) return null;
        return (
          <span
            key={idx}
            className="text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap"
            title={`Rango ${v.age_min??'?' }-${v.age_max??'?'} ${v.age_unit||'años'}`}
          >{line}</span>
        );
      })}
    </div>
  );
};

export default ReferenceValueSummary;
