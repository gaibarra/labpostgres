import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, XCircle } from 'lucide-react';
import ReferenceValueInput from './ReferenceValueInput';
import ParameterConfirmationDialog from './ParameterConfirmationDialog';
import { v4 as uuidv4 } from 'uuid';

const getInitialParameter = (parameter) => {
  return {
    id: parameter?.id || null,
    tempId: parameter?.tempId || uuidv4(),
    name: parameter?.name || '',
    unit: parameter?.unit || '',
    group: parameter?.group || 'General',
    decimal_places: typeof parameter?.decimal_places === 'number' ? parameter.decimal_places : 0,
    valorReferencia: parameter?.valorReferencia?.map(vr => ({ ...vr, id: vr.id || uuidv4() })) || [],
  };
};

const ParameterEditDialog = ({ isOpen, onOpenChange, onSave, parameter: initialParameter, isSubmitting }) => {
  const [parameter, setParameter] = useState(getInitialParameter(initialParameter));

  useEffect(() => {
    if (isOpen) {
      setParameter(getInitialParameter(initialParameter));
    }
  }, [initialParameter, isOpen]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setParameter(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
  };

  const handleReferenceChange = (index, field, value) => {
    const newValorReferencia = [...parameter.valorReferencia];
    newValorReferencia[index][field] = value;
    setParameter(prev => ({ ...prev, valorReferencia: newValorReferencia }));
  };

  const addReferenceValue = () => {
    const newValorReferencia = [...parameter.valorReferencia, { id: uuidv4(), gender: 'ambos', age_min: 0, age_max: 99, normal_min: '', normal_max: '', critical_min: '', critical_max: '' }];
    setParameter(prev => ({ ...prev, valorReferencia: newValorReferencia }));
  };

  const removeReferenceValue = (index) => {
    const newValorReferencia = [...parameter.valorReferencia];
    newValorReferencia.splice(index, 1);
    setParameter(prev => ({ ...prev, valorReferencia: newValorReferencia }));
  };

  const handleSave = () => {
    if (!parameter.name) {
      alert('El nombre del parámetro es requerido.');
      return;
    }
    // Normaliza campos de valores de referencia al formato consumido aguas abajo
    const normalizedVR = (parameter.valorReferencia||[]).map(v => ({
      id: v.id || uuidv4(),
      gender: v.gender || v.sexo || 'ambos',
      age_min: v.age_min ?? v.edadMin ?? null,
      age_max: v.age_max ?? v.edadMax ?? null,
      age_unit: v.age_unit || v.unidadEdad || 'años',
      tipoValor: v.tipoValor || (v.textoLibre ? 'textoLibre' : (v.textoPermitido ? 'alfanumerico' : 'numerico')),
      normal_min: v.normal_min ?? v.valorMin ?? null,
      normal_max: v.normal_max ?? v.valorMax ?? null,
      textoPermitido: v.textoPermitido ?? '',
      textoLibre: v.textoLibre ?? '',
      notas: v.notas ?? ''
    }));
    onSave?.({ ...parameter, valorReferencia: normalizedVR, decimal_places: Number(parameter.decimal_places) || 0 });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl mx-auto p-4 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{parameter?.id ? 'Editar Parámetro' : 'Nuevo Parámetro'}</DialogTitle>
            <DialogDescription>
              Completa los datos del parámetro y sus valores de referencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scroll flex-1" style={{ WebkitOverflowScrolling:'touch' }}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 py-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">Nombre del Parámetro</Label>
                <Input id="name" name="name" value={parameter.name} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="unit">Unidades</Label>
                <Input id="unit" name="unit" value={parameter.unit} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="decimal_places">Decimales</Label>
                <Input id="decimal_places" name="decimal_places" type="number" min="0" value={parameter.decimal_places} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="group">Grupo</Label>
                <Input id="group" name="group" placeholder="Ej: Hematología" value={parameter.group} onChange={handleChange} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Valores de Referencia</h3>
              <div className="space-y-4">
                {parameter.valorReferencia?.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2 p-2 border rounded-md">
                    <ReferenceValueInput index={index} value={field} onChange={handleReferenceChange} isSubmitting={isSubmitting} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeReferenceValue(index)}>
                      <XCircle className="h-5 w-5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addReferenceValue}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Añadir Valor de Referencia
              </Button>
            </div>

            <div className="pt-2 sticky bottom-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="button" onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Parámetro'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  {/* Modal de confirmación eliminado */}
    </>
  );
};

export default ParameterEditDialog;
