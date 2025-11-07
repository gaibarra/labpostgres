import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelect from '@/components/ui/SearchableSelect';

const GENDER_OPTIONS = [
  { value: 'ambos', label: 'Ambos' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
];

const AGE_UNITS = ['días', 'meses', 'años'];

const VALUE_TYPES = [
  { value: 'numerico', label: 'Numérico (Rango)' },
  { value: 'alfanumerico', label: 'Alfanumérico (Texto)' },
  { value: 'textoLibre', label: 'Texto Libre (Descriptivo)' },
];

const ReferenceValueInput = ({ index, value, onChange, isSubmitting }) => {
  const handleChange = (field, fieldValue) => {
    onChange(index, field, fieldValue);
  };

  const val = {
    gender: value?.gender || 'ambos',
    age_min: value?.age_min || '',
    age_max: value?.age_max || '',
    age_unit: value?.age_unit || 'años',
    tipoValor: value?.tipoValor || 'numerico',
    normal_min: value?.normal_min || '',
    normal_max: value?.normal_max || '',
    textoPermitido: value?.textoPermitido || '',
    textoLibre: value?.textoLibre || '',
    notas: value?.notas || '',
  };

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <SearchableSelect
          value={val.gender}
          onValueChange={(v) => handleChange('gender', v)}
          options={GENDER_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          placeholder="Género"
          searchPlaceholder="Buscar género..."
          emptyText="Sin opciones"
          disabled={isSubmitting}
        />
        <Input type="number" placeholder="Edad Mín." value={val.age_min} onChange={(e) => handleChange('age_min', e.target.value)} disabled={isSubmitting} />
        <Input type="number" placeholder="Edad Máx." value={val.age_max} onChange={(e) => handleChange('age_max', e.target.value)} disabled={isSubmitting} />
        <SearchableSelect
          value={val.age_unit}
          onValueChange={(v) => handleChange('age_unit', v)}
          options={AGE_UNITS.map(u => ({ value: u, label: u }))}
          placeholder="Unidad"
          searchPlaceholder="Buscar unidad..."
          emptyText="Sin unidades"
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <SearchableSelect
          value={val.tipoValor}
          onValueChange={(v) => handleChange('tipoValor', v)}
          options={VALUE_TYPES.map(o => ({ value: o.value, label: o.label }))}
          placeholder="Tipo de Valor"
          searchPlaceholder="Buscar tipo..."
          emptyText="Sin tipos"
          disabled={isSubmitting}
        />
        {val.tipoValor === 'numerico' && (
          <>
            <Input type="number" placeholder="Normal Mín." value={val.normal_min} onChange={(e) => handleChange('normal_min', e.target.value)} disabled={isSubmitting} />
            <Input type="number" placeholder="Normal Máx." value={val.normal_max} onChange={(e) => handleChange('normal_max', e.target.value)} disabled={isSubmitting} />
          </>
        )}
        {val.tipoValor === 'alfanumerico' && (
          <Input
            placeholder="Texto Permitido (ej. Positivo, Negativo)"
            value={val.textoPermitido}
            onChange={(e) => handleChange('textoPermitido', e.target.value)}
            className="md:col-span-2"
            disabled={isSubmitting}
          />
        )}
        {val.tipoValor === 'textoLibre' && (
          <Textarea
            placeholder="Ingrese el texto descriptivo de referencia..."
            value={val.textoLibre}
            onChange={(e) => handleChange('textoLibre', e.target.value)}
            className="md:col-span-2 h-20"
            disabled={isSubmitting}
          />
        )}
      </div>

      <Textarea
        placeholder="Notas Adicionales (ej. ayuno)"
        value={val.notas}
        onChange={(e) => handleChange('notas', e.target.value)}
        className="h-16"
        disabled={isSubmitting}
      />
    </div>
  );
};

export default ReferenceValueInput;
