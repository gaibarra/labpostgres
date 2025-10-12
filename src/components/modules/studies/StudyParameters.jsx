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
// Secuencia estática para tipos de parámetro (estable fuera del componente)
const TIPO_SEQUENCE = ['numerico','alfanumerico','textoLibre'];
import ParameterEditDialog from "./ParameterEditDialog";
import React, {
  useState,
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
  // Mapear claves modernas y legadas
  tipoValor: v.tipoValor || (v.textoLibre || v.text_value ? 'textoLibre' : (v.textoPermitido ? 'alfanumerico' : (v.normal_min != null || v.normal_max != null || v.lower != null || v.upper != null ? 'numerico' : 'textoLibre'))),
  normal_min: v.normal_min ?? v.valorMin ?? v.lower ?? null,
  normal_max: v.normal_max ?? v.valorMax ?? v.upper ?? null,
  textoPermitido: v.textoPermitido ?? '',
  textoLibre: v.textoLibre ?? v.text_value ?? '',
      notas: v.notas ?? '',
    };
  });
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ({ parameters = [], onParametersChange, isSubmitting, studyId, onImmediateSave, onImmediateDelete, onPersistOrder, _enableRangeDataAttributes }, ref) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingParameter, setEditingParameter] = useState(null);
    const [localParameters, setLocalParameters] = useState(parameters);
  const [isParamSaving, setIsParamSaving] = useState(false);
  const [savingIds, setSavingIds] = useState(new Set());
  // Inline name editing state
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  // Inline unit & decimals editing state
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editingUnitValue, setEditingUnitValue] = useState("");
  const [editingDecimalsValue, setEditingDecimalsValue] = useState(0);
  // Inline group editing state
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupValue, setEditingGroupValue] = useState("");
  // Inline ref type editing (applies to all valorReferencia entries of a parameter)
  const cycleTipo = useCallback((current) => {
    const idx = TIPO_SEQUENCE.indexOf(current);
    return TIPO_SEQUENCE[(idx + 1) % TIPO_SEQUENCE.length];
  }, []);
  // Reordenamiento reactivado

    // Asegura que cada parámetro tenga un identificador (id o tempId) para evitar
    // que operaciones (delete) filtren accidentalmente todos cuando id/tempId es undefined.
    useEffect(() => {
      let withIds = (parameters || []).map(p => {
        if (!p) return p;
        const base = { ...p };
        // Asegurar id temporal si falta
        if (!base.id && !base.tempId) base.tempId = uuidv4();
        // Normalizar ranges para la UI: mapear reference_ranges -> valorReferencia
        if (Array.isArray(base.reference_ranges) && (!Array.isArray(base.valorReferencia) || base.valorReferencia.length === 0)) {
          base.valorReferencia = mapReferenceValues(base.reference_ranges);
        }
        return base;
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
      openParameterByIndex: (index) => {
        if (index == null || index < 0 || index >= localParameters.length) return;
        handleEdit(localParameters[index]);
      }
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
        // Diferimos notificación al padre para evitar nested setState durante render.
        queueMicrotask(()=> onParametersChange(newParameters));
        return newParameters;
      });
    }, [onParametersChange]);

    // --- Reordenamiento ---
    const applyReorder = useCallback((updated) => {
      // Asignar posición secuencial
      const withPos = updated.map((p, idx) => ({ ...p, position: idx }));
      setLocalParameters(withPos);
      queueMicrotask(()=> onParametersChange(withPos));
      if (studyId && typeof onPersistOrder === 'function') {
        // Persistir sólo si hay estudio existente (no difiere porque es efecto lado servidor)
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
  queueMicrotask(()=> onParametersChange([...filteredList]));
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
              queueMicrotask(()=> onParametersChange(updated)); // evita nested updates
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
  }, [localParameters, onParametersChange, onImmediateSave, onImmediateDelete, studyId]);

    // --- Inline name editing helpers ---
    const startInlineEdit = useCallback((param) => {
      if (isSubmitting || isParamSaving) return;
      const key = param.id || param.tempId;
      setEditingNameId(key);
      setEditingNameValue(param.name || "");
    }, [isSubmitting, isParamSaving]);

    const cancelInlineEdit = useCallback(() => {
      setEditingNameId(null);
      setEditingNameValue("");
    }, []);

    const commitInlineEdit = useCallback(async () => {
      const key = editingNameId;
      if (!key) return;
      const trimmed = (editingNameValue||"").trim();
      if (!trimmed) { toast.error('El nombre no puede estar vacío'); return; }
      // Unicidad
      const duplicate = localParameters.find(p => (p.id || p.tempId) !== key && (p.name||'').trim().toLowerCase() === trimmed.toLowerCase());
      if (duplicate) { toast.error('Nombre duplicado', { description: 'Ya existe otro parámetro con ese nombre.' }); return; }
      const target = localParameters.find(p => (p.id || p.tempId) === key);
      if (!target) { cancelInlineEdit(); return; }
      const updated = { ...target, name: trimmed };
      // Actualiza local inmediatamente
      setLocalParameters(prev => {
        const next = prev.map(p => (p.id || p.tempId) === key ? updated : p);
        queueMicrotask(()=> onParametersChange(next));
        return next;
      });
      cancelInlineEdit();
      // Persistir si aplica
      if (studyId && onImmediateSave) {
        try {
          setIsParamSaving(true);
          setSavingIds(prev => new Set([...Array.from(prev), key]));
          await onImmediateSave(studyId, updated);
        } finally {
          setIsParamSaving(false);
          setSavingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
        }
      }
    }, [editingNameId, editingNameValue, localParameters, onParametersChange, studyId, onImmediateSave, cancelInlineEdit]);

    // ---- Inline unit & decimals editing ----
    const startUnitEdit = useCallback((param) => {
      if (isSubmitting || isParamSaving) return;
      const key = param.id || param.tempId;
      setEditingUnitId(key);
      setEditingUnitValue(param.unit || "");
      setEditingDecimalsValue(typeof param.decimal_places === 'number' ? param.decimal_places : 0);
    }, [isSubmitting, isParamSaving]);

    const cancelUnitEdit = useCallback(() => {
      setEditingUnitId(null);
      setEditingUnitValue("");
      setEditingDecimalsValue(0);
    }, []);

    const commitUnitEdit = useCallback(async () => {
      const key = editingUnitId;
      if (!key) return;
      let decimals = parseInt(editingDecimalsValue, 10);
      if (isNaN(decimals) || decimals < 0) decimals = 0;
      if (decimals > 6) decimals = 6; // límite razonable
      const target = localParameters.find(p => (p.id || p.tempId) === key);
      if (!target) { cancelUnitEdit(); return; }
      const updated = { ...target, unit: editingUnitValue.trim(), decimal_places: decimals };
      setLocalParameters(prev => {
        const next = prev.map(p => (p.id || p.tempId) === key ? updated : p);
        queueMicrotask(()=> onParametersChange(next));
        return next;
      });
      cancelUnitEdit();
      if (studyId && onImmediateSave) {
        try {
          setIsParamSaving(true);
          setSavingIds(prev => new Set([...Array.from(prev), key]));
          await onImmediateSave(studyId, updated);
        } finally {
          setIsParamSaving(false);
          setSavingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
        }
      }
    }, [editingUnitId, editingUnitValue, editingDecimalsValue, localParameters, onParametersChange, studyId, onImmediateSave, cancelUnitEdit]);

    // ---- Inline group editing ----
    const startGroupEdit = useCallback((param) => {
      if (isSubmitting || isParamSaving) return;
      const key = param.id || param.tempId;
      setEditingGroupId(key);
      setEditingGroupValue(param.group || "");
    }, [isSubmitting, isParamSaving]);

    const cancelGroupEdit = useCallback(() => {
      setEditingGroupId(null);
      setEditingGroupValue("");
    }, []);

    const commitGroupEdit = useCallback(async () => {
      const key = editingGroupId;
      if (!key) return;
      const value = (editingGroupValue || '').trim();
      const target = localParameters.find(p => (p.id || p.tempId) === key);
      if (!target) { cancelGroupEdit(); return; }
      const updated = { ...target, group: value || 'General' };
      setLocalParameters(prev => {
        const next = prev.map(p => (p.id || p.tempId) === key ? updated : p);
        queueMicrotask(()=> onParametersChange(next));
        return next;
      });
      cancelGroupEdit();
      if (studyId && onImmediateSave) {
        try {
          setIsParamSaving(true);
          setSavingIds(prev => new Set([...Array.from(prev), key]));
          await onImmediateSave(studyId, updated);
        } finally {
          setIsParamSaving(false);
          setSavingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
        }
      }
    }, [editingGroupId, editingGroupValue, localParameters, onParametersChange, studyId, onImmediateSave, cancelGroupEdit]);

    // ---- Inline tipoValor editing (batch for all reference ranges) ----
    // Infiera el tipo del parámetro para mostrar la etiqueta compacta.
    // Corrección: si no hay valores de referencia o todos son placeholders sin límites/textos,
    // mostrarmos 'textoLibre' en lugar de 'numérico' (evita el letrero incorrecto).
  const unifiedTipo = (param) => {
      const list = Array.isArray(param.valorReferencia) ? param.valorReferencia : [];
      // Si no hay filas aún, asumimos Texto Libre (edición libre del resultado)
      if (list.length === 0) return 'textoLibre';
      const infer = (v) => {
    const tipo = v?.tipoValor;
    const hasNum = (v?.normal_min != null || v?.normal_max != null || v?.lower != null || v?.upper != null);
    const hasPermitido = !!v?.textoPermitido;
    const hasLibre = !!(v?.textoLibre || v?.text_value);
        if (tipo) return tipo;
        if (hasLibre) return 'textoLibre';
        if (hasPermitido) return 'alfanumerico';
        if (hasNum) return 'numerico';
        // placeholder sin datos: tratar como texto libre para la UI
        return 'textoLibre';
      };
      const inferred = list.map(infer);
      const first = inferred[0];
      const allSame = inferred.every(t => t === first);
      return allSame ? first : 'mixto';
    };

    const handleCycleTipo = useCallback(async (param) => {
      if (isSubmitting || isParamSaving) return;
      const currentUnified = unifiedTipo(param);
      // If mixed, start from numerico
      const base = currentUnified === 'mixto' ? 'numerico' : currentUnified;
      const next = cycleTipo(base);
      const key = param.id || param.tempId;
      const updatedVR = (param.valorReferencia||[]).map(v => ({ ...v, tipoValor: next }));
      const updatedParam = { ...param, valorReferencia: updatedVR };
      setLocalParameters(prev => {
        const nextList = prev.map(p => (p.id || p.tempId) === key ? updatedParam : p);
        queueMicrotask(()=> onParametersChange(nextList));
        return nextList;
      });
      if (studyId && onImmediateSave) {
        try {
          setIsParamSaving(true);
          setSavingIds(prev => new Set([...Array.from(prev), key]));
          await onImmediateSave(studyId, updatedParam);
        } finally {
          setIsParamSaving(false);
          setSavingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
        }
      }
  }, [isSubmitting, isParamSaving, onParametersChange, studyId, onImmediateSave, cycleTipo]);

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
                <TableHead>Grupo</TableHead>
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
                  data-param-index={idx}
                >
                  <TableCell className="font-medium py-2 flex items-center gap-2">
                    {/* Eliminado drag handle */}
                    {editingNameId === (param.id || param.tempId) ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editingNameValue}
                          onChange={e => setEditingNameValue(e.target.value)}
                          onBlur={commitInlineEdit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
                            else if (e.key === 'Escape') { cancelInlineEdit(); }
                          }}
                          className="h-7 w-40"
                          disabled={isSubmitting || isParamSaving}
                        />
                      </div>
                    ) : (
                      <span
                        className="cursor-text hover:underline decoration-dotted"
                        title="Doble clic o clic en el nombre para editar"
                        onClick={() => startInlineEdit(param)}
                        onDoubleClick={() => startInlineEdit(param)}
                      >{param.name}</span>
                    )}
                    <Badge variant={persisted ? 'secondary' : 'outline'} className="text-[10px] px-1 py-0">
                      {persisted ? 'DB' : 'Local'}
                    </Badge>
          {busy && <Loader2 className="h-3 w-3 animate-spin text-sky-500" />}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col gap-1">
                      <ReferenceValueSummary values={param.valorReferencia} />
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-6 text-[10px] px-2"
                          disabled={isSubmitting || isParamSaving}
                          onClick={() => handleCycleTipo(param)}
                          title="Clic para cambiar el tipo de valor (numerico → alfanumerico → textoLibre)"
                        >
                          {(() => {
                            const t = unifiedTipo(param);
                            if (t === 'mixto') return 'tipo: mixto';
                            if (t === 'numerico') return 'tipo: numérico';
                            if (t === 'alfanumerico') return 'tipo: alfanum';
                            if (t === 'textoLibre') return 'tipo: texto';
                            return t;
                          })()}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {editingGroupId === (param.id || param.tempId) ? (
                      <Input
                        autoFocus
                        value={editingGroupValue}
                        placeholder="Grupo"
                        className="h-7 w-36"
                        onChange={e => setEditingGroupValue(e.target.value)}
                        onBlur={commitGroupEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitGroupEdit(); }
                          else if (e.key === 'Escape') { cancelGroupEdit(); }
                        }}
                        disabled={isSubmitting || isParamSaving}
                      />
                    ) : (
                      <span
                        className="cursor-text hover:underline decoration-dotted"
                        title="Clic para editar el grupo"
                        onClick={() => startGroupEdit(param)}
                        onDoubleClick={() => startGroupEdit(param)}
                      >{param.group || <span className="text-xs text-muted-foreground">General</span>}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {editingUnitId === (param.id || param.tempId) ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingUnitValue}
                          placeholder="Unidad"
                          onChange={e => setEditingUnitValue(e.target.value)}
                          className="h-7 w-24"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitUnitEdit(); }
                            else if (e.key === 'Escape') { cancelUnitEdit(); }
                          }}
                        />
                        <Input
                          type="number"
                          value={editingDecimalsValue}
                          onChange={e => setEditingDecimalsValue(e.target.value)}
                          className="h-7 w-16"
                          min={0}
                          max={6}
                          title="Decimales"
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitUnitEdit(); }
                            else if (e.key === 'Escape') { cancelUnitEdit(); }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-green-600"
                          onClick={commitUnitEdit}
                          disabled={isSubmitting || isParamSaving}
                        >OK</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-500"
                          onClick={cancelUnitEdit}
                          disabled={isSubmitting || isParamSaving}
                        >X</Button>
                      </div>
                    ) : (
                      <div
                        className="cursor-text hover:underline decoration-dotted"
                        title="Clic para editar unidad y decimales"
                        onClick={() => startUnitEdit(param)}
                        onDoubleClick={() => startUnitEdit(param)}
                      >
                        {param.unit || <span className="text-xs text-muted-foreground">(sin unidad)</span>}
                        {typeof param.decimal_places === 'number' && <span className="ml-1 text-[10px] text-slate-500">[{param.decimal_places}]</span>}
                      </div>
                    )}
                  </TableCell>
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