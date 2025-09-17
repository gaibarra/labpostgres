// Elimina parámetros duplicados por id antes de guardar
function removeDuplicateParameters(params) {
  const seen = new Set();
  return params.filter(p => {
    const id = p.id || p.tempId;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
import ParameterEditDialog from "./ParameterEditDialog";
import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
} from "react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
// ...existing code...

// Mapea los valores de referencia al formato esperado por ReferenceValueInput
function mapReferenceValues(values) {
  if (!Array.isArray(values)) return [];
  return values.map(v => {
    const raw = (v.gender || v.sexo || 'ambos').toString().trim().toLowerCase();
    const gender = raw.startsWith('masc') ? 'masculino' : raw.startsWith('fem') ? 'femenino' : 'ambos';
    return {
      id: v.id || uuidv4(),
      gender,
      age_min: v.age_min ?? v.edadMin ?? null,
      age_max: v.age_max ?? v.edadMax ?? null,
      age_unit: v.age_unit ?? v.unidadEdad ?? 'años',
      tipoValor: v.tipoValor || (v.textoLibre ? 'textoLibre' : (v.textoPermitido ? 'alfanumerico' : 'numerico')),
      normal_min: v.normal_min ?? v.valorMin ?? null,
      normal_max: v.normal_max ?? v.valorMax ?? null,
      textoPermitido: v.textoPermitido ?? '',
      textoLibre: v.textoLibre ?? '',
      notas: v.notas ?? '',
    };
  });
}
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Edit, Trash2, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import ReferenceValueSummary from "./ReferenceValueSummary";
// ...existing code...

const StudyParameters = forwardRef(
  ({ parameters = [], onParametersChange, isSubmitting, studyId, onImmediateSave, onImmediateDelete, onPersistOrder }, ref) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingParameter, setEditingParameter] = useState(null);
    const [localParameters, setLocalParameters] = useState(parameters);
  const [isParamSaving, setIsParamSaving] = useState(false);
  const [savingIds, setSavingIds] = useState(new Set());
  // Reordenamiento reactivado

    // Asegura que cada parámetro tenga un identificador (id o tempId) para evitar
    // que operaciones (delete) filtren accidentalmente todos cuando id/tempId es undefined.
    useEffect(() => {
      let withIds = (parameters || []).map(p => {
        if (!p) return p;
        if (!p.id && !p.tempId) {
          return { ...p, tempId: uuidv4() };
        }
        return p;
      });
      // Si existen posiciones numéricas, ordenar por ellas
      const hasPositions = withIds.some(p => typeof p?.position === 'number');
      if (hasPositions) {
        withIds = [...withIds].sort((a,b) => {
          const ap = typeof a.position === 'number' ? a.position : Number.MAX_SAFE_INTEGER;
            const bp = typeof b.position === 'number' ? b.position : Number.MAX_SAFE_INTEGER;
            return ap - bp;
        });
      }
      setLocalParameters(withIds);
    }, [parameters]);

    useImperativeHandle(ref, () => ({
      openNew: () => handleAddNew(),
      getParameters: () => localParameters,
    }));

    const handleAddNew = useCallback(() => {
      setEditingParameter({
        tempId: uuidv4(),
        name: "",
        unit: "",
        group: "General",
        decimal_places: 0,
  // position removido
        valorReferencia: [
          {
            id: uuidv4(),
            gender: 'ambos',
            age_min: null,
            age_max: null,
            age_unit: 'años',
            tipoValor: 'numerico',
            normal_min: null,
            normal_max: null,
            textoPermitido: '',
            textoLibre: '',
            notas: '',
          },
        ],
      });
      setIsDialogOpen(true);
    }, []);

  const handleEdit = useCallback((parameter) => {
      // Mapeo de valores de referencia antes de editar
      const mappedParameter = {
        ...parameter,
        decimal_places: typeof parameter.decimal_places === 'number' ? parameter.decimal_places : 0,
        valorReferencia: mapReferenceValues(parameter.valorReferencia)
      };
      setEditingParameter(mappedParameter);
      setIsDialogOpen(true);
    }, []);

    const handleDelete = useCallback((parameterToDelete) => {
      if (!parameterToDelete) return;
      const toDeleteId = parameterToDelete.id || parameterToDelete.tempId;
      if (!toDeleteId) {
        console.warn('[StudyParameters] Intento de eliminar parámetro sin id/tempId. Se asignará tempId y se aborta para evitar borrado masivo.');
        // Refresca local list asignando tempIds faltantes
        setLocalParameters(prev => prev.map(p => (!p.id && !p.tempId) ? { ...p, tempId: uuidv4() } : p));
        return;
      }
      setLocalParameters(prev => {
        const newParameters = prev
          .filter(p => (p.id || p.tempId) !== toDeleteId)
          .map((p, idx) => ({ ...p, position: idx })); // re-asigna posiciones
        onParametersChange(newParameters);
        return newParameters;
      });
    }, [onParametersChange]);

    // --- Reordenamiento ---
    const applyReorder = useCallback((updated) => {
      // Asignar posición secuencial
      const withPos = updated.map((p, idx) => ({ ...p, position: idx }));
      setLocalParameters(withPos);
      onParametersChange(withPos);
      if (studyId && typeof onPersistOrder === 'function') {
        // Persistir sólo si hay estudio existente
        onPersistOrder(studyId, withPos);
      }
    }, [onParametersChange, onPersistOrder, studyId]);

    const moveParameter = useCallback((param, direction) => {
      setLocalParameters(prev => {
        const list = [...prev];
        const key = param.id || param.tempId;
        const index = list.findIndex(p => (p.id || p.tempId) === key);
        if (index === -1) return prev;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= list.length) return prev; // fuera de rango
        const [removed] = list.splice(index, 1);
        list.splice(newIndex, 0, removed);
        // Aplicar cambios fuera del setState callback para no depender de closure viejo
        // pero necesitamos devolver la nueva lista para el estado y además persistir.
        // Persistimos después del set vía microtask para garantizar estado actualizado.
        queueMicrotask(() => applyReorder(list));
        return list;
      });
    }, [applyReorder]);

    const handleSave = useCallback(async (parameterToSave) => {
      // Validación básica nombre requerido
      if (!parameterToSave.name || !parameterToSave.name.trim()) {
        toast.error('El nombre del parámetro es requerido');
        return;
      }
      // Nombre único (case-insensitive) dentro del estudio
      const normalized = parameterToSave.name.trim().toLowerCase();
      const duplicate = localParameters.find(p => (p.id || p.tempId) !== (parameterToSave.id || parameterToSave.tempId) && (p.name || '').trim().toLowerCase() === normalized);
      if (duplicate) {
        toast.error('Nombre duplicado', { description: 'Ya existe otro parámetro con ese nombre.' });
        return;
      }
      const idToFind = parameterToSave.tempId || parameterToSave.id;
      let found = false;
      const list = localParameters.map(p => {
        if ((p.tempId || p.id) === idToFind) {
          found = true;
          // Reemplaza completamente el parámetro editado
          return { ...parameterToSave };
        }
        return p;
      });
      // Si es nuevo, agregarlo
      const finalList = found ? list : [...list, { ...parameterToSave }];
      // Eliminar duplicados antes de guardar
      const filteredList = removeDuplicateParameters(finalList);
      setLocalParameters([...filteredList]); // Actualiza el estado local para re-render inmediato
      onParametersChange([...filteredList]);
      const isNew = !parameterToSave.id && !studyId;
      setIsDialogOpen(false);
      setEditingParameter(null);
      if (onImmediateSave && studyId) {
        try {
          setIsParamSaving(true);
          setSavingIds(prev => new Set([...Array.from(prev), (parameterToSave.id || parameterToSave.tempId)]));
          const saved = await onImmediateSave(studyId, parameterToSave);
          if (!saved) {
            toast.error('No se pudo persistir el parámetro');
          } else if (saved?.id) {
            // Integrar resultado guardado usando el estado más reciente y propagar hacia arriba dentro del mismo ciclo
            setLocalParameters(prev => {
              const savedKey = parameterToSave.id || parameterToSave.tempId;
              const updated = prev.map(p => {
                const key = p.id || p.tempId;
                if (key === savedKey) {
                  return { ...p, ...saved };
                }
                return p;
              });
              onParametersChange(updated); // evita usar closure obsoleto
              return updated;
            });
            toast.success('Parámetro guardado', {
              action: studyId && onImmediateDelete ? {
                label: 'Deshacer',
                onClick: async () => {
                  await onImmediateDelete(studyId, saved.id);
                }
              } : undefined
            });
          }
        } finally {
          setIsParamSaving(false);
          setSavingIds(prev => {
            const n = new Set(prev);
            n.delete(parameterToSave.id || parameterToSave.tempId);
            return n;
          });
        }
      } else {
        toast.success(isNew ? 'Parámetro listo (guardado local). Guarda el estudio para persistir.' : 'Parámetro actualizado localmente.');
      }
    }, [localParameters, onParametersChange, onImmediateSave, studyId]);

  // Duplicar parámetro eliminado

    return (
      <div className="mx-auto w-full max-w-5xl bg-transparent">
        {!localParameters || localParameters.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              Aún no se han añadido parámetros.
            </p>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleAddNew}
              disabled={isSubmitting}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir el primero
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex justify-end mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddNew}
                disabled={isSubmitting}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Parámetro
              </Button>
            </div>
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Parámetro</TableHead>
                <TableHead className="w-[35%]">Valores de Referencia</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead className="text-right w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
      {localParameters.map((param, idx) => {
        const persisted = !!param.id;
        const busy = savingIds.has(param.id || param.tempId);
    // Garantiza una key estable incluso si faltan id/tempId (fallback controlado)
    const rowKey = param.tempId || param.id || `local-${idx}`;
                return (
                <TableRow
                  key={rowKey}
                  className='transition-colors'
                >
                  <TableCell className="font-medium py-2 flex items-center gap-2">
                    {/* Eliminado drag handle */}
                    {param.name}
                    <Badge variant={persisted ? 'secondary' : 'outline'} className="text-[10px] px-1 py-0">
                      {persisted ? 'DB' : 'Local'}
                    </Badge>
          {busy && <Loader2 className="h-3 w-3 animate-spin text-sky-500" />}
                  </TableCell>
                  <TableCell className="py-2">
                    <ReferenceValueSummary values={param.valorReferencia} />
                  </TableCell>
                  <TableCell className="py-2">{param.unit}</TableCell>
                  <TableCell className="text-right py-2">
                    <div className="inline-flex flex-col mr-1 align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="move up"
                        disabled={idx === 0 || isSubmitting}
                        onClick={() => moveParameter(param, 'up')}
                        className="h-5 w-5"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="move down"
                        disabled={idx === localParameters.length - 1 || isSubmitting}
                        onClick={() => moveParameter(param, 'down')}
                        className="h-5 w-5"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="edit"
                      onClick={() => handleEdit(param)}
                      disabled={isSubmitting}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {/* Acción duplicar eliminada */}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="delete"
                      onClick={() => handleDelete(param)}
                      className="text-red-500 hover:text-red-600"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
          </div>
        )}

    {isDialogOpen && (
          <ParameterEditDialog
            key={editingParameter?.tempId || editingParameter?.id}
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            parameter={editingParameter}
      onSave={handleSave}
      isSubmitting={isSubmitting || isParamSaving}
      existingNames={localParameters.map(p => p.name)}
          />
        )}
      </div>
    );
  }
);

StudyParameters.displayName = "StudyParameters";
export default StudyParameters;