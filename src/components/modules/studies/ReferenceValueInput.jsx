import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
        <Select onValueChange={(v) => handleChange('gender', v)} value={val.gender} disabled={isSubmitting}>
          <SelectTrigger><SelectValue placeholder="Género" /></SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="number" placeholder="Edad Mín." value={val.age_min} onChange={(e) => handleChange('age_min', e.target.value)} disabled={isSubmitting} />
        <Input type="number" placeholder="Edad Máx." value={val.age_max} onChange={(e) => handleChange('age_max', e.target.value)} disabled={isSubmitting} />
        <Select onValueChange={(v) => handleChange('age_unit', v)} value={val.age_unit} disabled={isSubmitting}>
          <SelectTrigger><SelectValue placeholder="Unidad" /></SelectTrigger>
          <SelectContent>
            {AGE_UNITS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Select onValueChange={(v) => handleChange('tipoValor', v)} value={val.tipoValor} disabled={isSubmitting}>
          <SelectTrigger><SelectValue placeholder="Tipo de Valor" /></SelectTrigger>
          <SelectContent>
            {VALUE_TYPES.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
